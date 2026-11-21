import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import {
  classify, masterCode, isPaused, recordOutcome, pausedReply, foreignReply,
  pageQuery, checkoutUrl, CHARGE_ID,
} from "./finance.ts";
import {
  json, serviceClient, loadCredentials, masterRequest, logEvent,
  PDV_API_PREFIX, PDV_PRODUCT_HEADERS, type MasterReply,
} from "../_shared/master.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => {
  const r = json(body, status);
  for (const [k, v] of Object.entries(cors)) r.headers.set(k, v);
  return r;
};

const service = (res: MasterReply) => ({
  state: classify(res),
  code: masterCode(res),
  http_status: res.status,
  message: res.message,
  data: res.ok ? res.data : null,
});

const str = (v: unknown) => (typeof v === "string" ? v : null);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("subscription"),
    charges_page: z.number().int().min(1).max(1000).optional(),
    payments_page: z.number().int().min(1).max(1000).optional(),
  }),
  z.object({ action: z.literal("checkout"), charge_id: z.string().regex(CHARGE_ID) }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return reply({ error: "Sessão não enviada" }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: claims } = await userClient.auth.getClaims(auth.slice(7).trim());
    const userId = claims?.claims?.sub;
    if (!userId) return reply({ error: "Sessão inválida. Entre novamente." }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({ action: "subscription" })));
    if (!parsed.success) return reply({ error: "Pedido inválido." }, 400);
    const body = parsed.data;

    const db = serviceClient();
    // Owner (admin) or a user explicitly authorized for "Minha Assinatura".
    const { data: profile } = await db.from("profiles").select("role, permissions").eq("user_id", userId).maybeSingle();
    const perms = (profile?.permissions ?? {}) as Record<string, unknown>;
    if (!profile || (profile.role !== "admin" && perms.subscription !== true)) {
      return reply({ error: "Apenas o proprietário ou um usuário autorizado pode ver a assinatura." }, 403);
    }

    const creds = await loadCredentials(db).catch(() => null);
    if (!creds) return reply({ configured: false });

    // The installation id and token come only from the server config — never from the browser.
    const get = (path: string) => masterRequest(creds, "GET", `${PDV_API_PREFIX}${path}`, undefined, PDV_PRODUCT_HEADERS);
    const refuse = async (key: string, res: MasterReply): Promise<MasterReply> => {
      const foreign = res.ok ? foreignReply(res.data, creds.installationId) : null;
      if (!foreign) return res;
      await logEvent(db, "failure", `Resposta financeira recusada (${key}): ${foreign}`, { http_status: res.status });
      return { ok: false, status: 403, data: { code: "foreign_reply" }, message: `A resposta do Painel Master era de ${foreign} e foi recusada.` };
    };

    // ---- Checkout: the Master creates it; the PDV only opens the returned link. ----
    if (body.action === "checkout") {
      const chargePath = `/installations/{id}/charges/${encodeURIComponent(body.charge_id)}`;
      const charge = await refuse("cobrança", await get(chargePath));
      if (!charge.ok) {
        return reply({ ok: false, state: classify(charge), code: masterCode(charge), message: charge.message ?? `HTTP ${charge.status}` });
      }
      if (obj(obj(charge.data).charge).payable !== true) {
        return reply({ ok: false, state: "not_payable", message: "Esta cobrança não está disponível para pagamento." });
      }
      const res = await refuse("checkout", await masterRequest(creds, "POST", `${PDV_API_PREFIX}${chargePath}/checkout`, undefined, PDV_PRODUCT_HEADERS));
      const link = res.ok ? checkoutUrl(res.data) : null;
      await logEvent(db, res.ok && link ? "subscription" : "failure",
        res.ok && link ? "Checkout solicitado ao Painel Master" : `Falha ao solicitar checkout: ${res.message ?? `HTTP ${res.status}`}`,
        { http_status: res.status, charge_id: body.charge_id });
      if (!res.ok) return reply({ ok: false, state: classify(res), code: masterCode(res), message: res.message ?? `HTTP ${res.status}` });
      if (!link) return reply({ ok: false, state: "error", message: "O Painel Master não devolveu um link de pagamento seguro." });
      return reply({ ok: true, checkout_url: link });
    }

    // 1) Identify this installation and its store through the published PDV route.
    const verify = await masterRequest(creds, "POST", `${PDV_API_PREFIX}/verify`, undefined, PDV_PRODUCT_HEADERS);
    const v = obj(verify.data);
    const inst = obj(v.installation);
    const store = obj(v.store);
    const lic = obj(v.license);
    const replyInstallation = (str(v.installation_id) ?? str(inst.id))?.toLowerCase() ?? null;
    const product = (str(v.product) ?? str(v.product_type))?.toLowerCase() ?? null;

    if (verify.ok && replyInstallation && replyInstallation !== creds.installationId) {
      await logEvent(db, "failure", "Resposta de assinatura recusada: outra instalação", { http_status: verify.status });
      return reply({ configured: true, refused: "A resposta do Painel Master era de outra instalação e foi recusada." });
    }
    if (verify.ok && product && product !== "pdv_salao") {
      await logEvent(db, "failure", "Resposta de assinatura recusada: outro produto", { http_status: verify.status, product });
      return reply({ configured: true, refused: `A resposta do Painel Master era de outro produto (${product}) e foi recusada.` });
    }

    // 2) Subscription and financial reads. Each one is independent: a failure or
    // pause in one never stops the others.
    const read = async (key: string, path: string) => {
      if (isPaused(key)) return pausedReply();
      const res = await get(path);
      recordOutcome(key, res);
      return refuse(key, res);
    };
    const [subscription, billing, history] = await Promise.all([
      read("subscription", "/installations/{id}/subscription"),
      read("charges", `/installations/{id}/charges${pageQuery(body.charges_page)}`),
      read("payments", `/installations/{id}/payments${pageQuery(body.payments_page)}`),
    ]);

    for (const [label, res] of [["verificação", verify], ["assinatura", subscription], ["cobranças", billing], ["pagamentos", history]] as const) {
      const state = classify(res);
      if (state === "temporary_error" || state === "auth_failed" || state === "unauthorized_installation" || state === "error") {
        await logEvent(db, "failure", `Falha ao consultar ${label}: ${res.message ?? `HTTP ${res.status}`}`, { http_status: res.status, state });
      }
    }

    return reply({
      configured: true,
      checked_at: new Date().toISOString(),
      identity: verify.ok ? {
        installation_id: replyInstallation ?? creds.installationId,
        installation_name: str(inst.name),
        product,
        store_id: str(store.id) ?? str(v.store_id),
        store_name: str(store.name),
        store_status: str(store.status),
        license_status: str(lic.status),
        license_active: typeof lic.active === "boolean" ? lic.active : null,
        license_valid_from: str(lic.valid_from),
        license_valid_until: str(lic.valid_until),
        license_message: str(lic.message),
      } : null,
      verify: { state: classify(verify), http_status: verify.status, message: verify.message },
      subscription: service(subscription),
      billing: service(billing),
      history: service(history),
    });
  } catch (err) {
    console.error("pdv-subscription error", err instanceof Error ? err.message : err);
    return reply({ error: "Erro ao consultar a assinatura" }, 500);
  }
});
