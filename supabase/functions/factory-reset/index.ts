import { createClient } from "npm:@supabase/supabase-js@2";
import { isLicenseSuspended, licenseSuspendedBody } from "../_shared/license.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// filhos antes dos pais
const WIPE_ORDER = [
  "returns",
  "sale_items",
  "stock_movements",
  "transactions",
  "sales",
  "sale_number_sequence",
  "product_complement_groups",
  "complement_items",
  "complement_groups",
  "store_products",
  "store_stock",
  "store_categories",
  "user_categories",
  "products",
  "categories",
  "customers",
  "suppliers",
  "seller_stores",
  "sellers",
  "payment_methods",
  "pix_settings",
  "store_settings",
  "user_stores",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
      return json({ error: "Configuração do servidor incompleta" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Sessão não enviada" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    const callerId = claims?.claims?.sub;
    if (claimsErr || !callerId) return json({ error: "Sessão inválida. Entre novamente." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Painel Master: a suspended license refuses every operation (it prevails over the admin lock).
    if (await isLicenseSuspended(admin)) return json(licenseSuspendedBody(), 403);

    const lockMessage = await adminLockMessage(admin);
    if (lockMessage) return json({ error: lockMessage }, 423);

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "APAGAR TUDO") return json({ error: "Confirmação inválida" }, 400);

    // primeiro super administrador = perfil admin mais antigo
    const { data: firstAdmin, error: faErr } = await admin
      .from("profiles")
      .select("user_id")
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (faErr || !firstAdmin) return json({ error: "Super administrador não encontrado" }, 500);
    if (firstAdmin.user_id !== callerId) {
      return json({ error: "Apenas o primeiro super administrador pode apagar todo o sistema" }, 403);
    }
    const keepId = firstAdmin.user_id as string;

    for (const table of WIPE_ORDER) {
      const { error } = await admin.from(table).delete().not("id", "is", null);
      if (error) return json({ error: `${table}: ${error.message}` }, 500);
    }

    // perfil do super admin fica sem loja
    await admin.from("profiles").update({ store_id: null }).eq("user_id", keepId);
    await admin.from("profiles").delete().neq("user_id", keepId);
    await admin.from("user_roles").delete().neq("user_id", keepId);

    // contas de login
    let page = 1;
    const toDelete: string[] = [];
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json({ error: `usuários: ${error.message}` }, 500);
      for (const u of data.users) if (u.id !== keepId) toDelete.push(u.id);
      if (data.users.length < 1000) break;
      page++;
    }
    for (const id of toDelete) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: `usuário ${id}: ${error.message}` }, 500);
    }

    const { error: storesErr } = await admin.from("stores").delete().not("id", "is", null);
    if (storesErr) return json({ error: `stores: ${storesErr.message}` }, 500);

    // arquivos (logos e fotos)
    for (const bucket of ["logos", "catalog-images"]) {
      const paths: string[] = [];
      const walk = async (prefix: string) => {
        const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        for (const f of data ?? []) {
          const p = prefix ? `${prefix}/${f.name}` : f.name;
          if (f.id) paths.push(p);
          else await walk(p);
        }
      };
      await walk("");
      for (let i = 0; i < paths.length; i += 100) {
        await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      }
    }

    return json({ ok: true, deletedUsers: toDelete.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// Painel Master: while the admin control is blocked, administrative changes are refused.
async function adminLockMessage(client: any): Promise<string | null> {
  const { data } = await client.from("pdv_controls").select("blocked, message").eq("key", "admin").maybeSingle();
  if (!data?.blocked) return null;
  const extra = (data.message ?? "").trim();
  return "O acesso administrativo está bloqueado pelo Painel Master." + (extra ? ` ${extra}` : "");
}
