import { z } from "npm:zod@3";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders, json, serviceClient, encryptSecret, logEvent, requireSession, loadCredentials, masterRequest, PDV_API_PREFIX, PDV_PRODUCT_HEADERS,
} from "../_shared/master.ts";
import { runSync } from "../_shared/sync.ts";
import { buildBackup, verifyBackup, PREPARE_RESET } from "../_shared/installation.ts";
import { decryptSecret } from "../_shared/master.ts";

const ImportSchema = z.object({
  action: z.literal("import_backup"),
  backup: z.unknown(),
  confirm_overwrite: z.boolean().default(false),
  expected_installation_id: z.string().trim().uuid().optional(),
});
const PrepareSchema = z.object({ action: z.literal("prepare_new_installation"), confirm: z.literal("PREPARAR") });
const BindSchema = z.object({
  action: z.literal("bind_installation"),
  base_url: z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "A URL precisa começar com https://"),
  installation_id: z.string().trim().uuid("O ID da instalação precisa ser um UUID"),
  token: z.string().trim().min(16, "Token muito curto").max(1000),
  store_name: z.string().trim().max(120).optional().or(z.literal("")),
});



const SaveSchema = z.object({
  action: z.literal("save_config"),
  base_url: z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "A URL precisa começar com https://"),
  installation_id: z.string().trim().uuid("O ID da instalação precisa ser um UUID"),
  token: z.string().trim().min(16, "Token muito curto").max(1000).optional().or(z.literal("")),
  store_name: z.string().trim().max(120).optional().or(z.literal("")),
});
const EventsSchema = z.object({
  action: z.literal("events"),
  kind: z.string().max(40).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  before: z.string().datetime().optional(),
});
const SyncSettingsSchema = z.object({
  action: z.literal("save_sync_settings"),
  interval_minutes: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(15), z.literal(30), z.literal(60)]),
  retention_days: z.union([z.literal(3), z.literal(7), z.literal(15), z.literal(30)]),
});
const SimpleSchema = z.object({
  action: z.enum(["overview", "disconnect", "commands", "test_connection", "reconnect", "sync_now", "cleanup_now", "pdv_bridge"]),
});

function maskIntegration(row: Record<string, any> | null) {
  if (!row) return null;
  const { token_encrypted, ...rest } = row;
  return { ...rest, has_token: Boolean(token_encrypted), token_masked: row.token_last4 ? `••••${row.token_last4}` : null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const db = serviceClient();
    const session = await requireSession(db, req);
    if (!session) return json({ error: "Sessão expirada. Entre novamente." }, 401);
    if (session.mustChangePassword) return json({ error: "Troque a senha antes de continuar." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = (body as { action?: string })?.action;

    if (action === "save_config") {
      const parsed = SaveSchema.safeParse(body);
      if (!parsed.success) {
        return json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, 400);
      }
      const { data: current } = await db.from("master_integration").select("*").eq("id", 1).single();
      const d = parsed.data;
      const update: Record<string, unknown> = {
        base_url: d.base_url.replace(/\/+$/, ""),
        installation_id: d.installation_id.toLowerCase(),
        store_name: d.store_name || null,
      };
      if (d.token) {
        update.token_encrypted = await encryptSecret(d.token);
        update.token_last4 = d.token.slice(-4);
      } else if (!current?.token_encrypted) {
        return json({ error: "Informe o token de API" }, 400);
      }
      const identityChanged = current?.base_url !== update.base_url
        || current?.installation_id !== update.installation_id || Boolean(d.token);
      if (identityChanged) {
        update.status = "disconnected";
        update.last_error = null;
      }
      await db.from("master_integration").update(update).eq("id", 1);
      await logEvent(db, "config", "Configuração da integração salva", {
        by: session.username,
        base_url: update.base_url,
        installation_id: update.installation_id,
        token_changed: Boolean(d.token),
      });
      const { data: saved } = await db.from("master_integration").select("*").eq("id", 1).single();
      return json({ integration: maskIntegration(saved) });
    }

    if (action === "save_sync_settings") {
      const parsed = SyncSettingsSchema.safeParse(body);
      if (!parsed.success) return json({ error: "Escolha um intervalo e um período de histórico válidos." }, 400);
      const { interval_minutes, retention_days } = parsed.data;
      const { data: applied, error } = await db.rpc("master_save_sync_settings", {
        _minutes: interval_minutes, _retention_days: retention_days,
      });
      if (error) throw error;
      await logEvent(db, "config", `Sincronização a cada ${interval_minutes} min; histórico de ${retention_days} dias`, {
        by: session.username, interval_minutes, retention_days, applied,
      });
      const { data: saved } = await db.from("master_integration").select("*").eq("id", 1).single();
      return json({ integration: maskIntegration(saved) });
    }

    if (action === "export_backup") {
      const secret = Deno.env.get("MASTER_ENCRYPTION_KEY");
      if (!secret) return json({ error: "Chave de criptografia não configurada." }, 503);
      const { data: c } = await db.from("master_integration").select("*").eq("id", 1).single();
      if (!c?.installation_id || !c?.token_encrypted) return json({ error: "Não há instalação vinculada para exportar." }, 400);
      const backup = await buildBackup(secret, {
        base_url: c.base_url, installation_id: c.installation_id, token_encrypted: c.token_encrypted,
        token_last4: c.token_last4, store_name: c.store_name,
        sync_interval_seconds: c.sync_interval_seconds, log_retention_days: c.log_retention_days,
      });
      await logEvent(db, "config", "Backup da comunicação exportado", { by: session.username, installation_id: c.installation_id });
      return json({ backup });
    }

    if (action === "import_backup") {
      const parsed = ImportSchema.safeParse(body);
      if (!parsed.success) return json({ error: "Dados inválidos" }, 400);
      const secret = Deno.env.get("MASTER_ENCRYPTION_KEY");
      if (!secret) return json({ error: "Chave de criptografia não configurada." }, 503);
      const check = await verifyBackup(secret, parsed.data.backup);
      if (!check.ok) return json({ error: check.reason }, 422);
      const cfg = check.backup.config;
      try { await decryptSecret(cfg.token_encrypted!); }
      catch { return json({ error: "O token do backup não pode ser lido com a chave de criptografia atual." }, 422); }
      const expected = parsed.data.expected_installation_id?.toLowerCase();
      if (expected && expected !== cfg.installation_id!.toLowerCase()) {
        return json({ error: "O backup pertence a outra instalação." }, 409);
      }
      const { data: cur } = await db.from("master_integration").select("installation_id").eq("id", 1).single();
      if (cur?.installation_id && cur.installation_id !== cfg.installation_id && !parsed.data.confirm_overwrite) {
        return json({ error: "Já existe outra instalação vinculada. Confirme a substituição para restaurar.", needs_confirmation: true }, 409);
      }
      const locked = await db.rpc("master_try_sync_lock", { _seconds: 120 });
      if (!locked.data) return json({ error: "Uma sincronização está em andamento. Tente em instantes." }, 409);
      await db.from("master_integration").update({
        base_url: cfg.base_url, installation_id: cfg.installation_id!.toLowerCase(), token_encrypted: cfg.token_encrypted,
        token_last4: cfg.token_last4, store_name: cfg.store_name, status: "disconnected", last_error: null, sync_lock_until: null,
      }).eq("id", 1);
      const minutes = Math.round(cfg.sync_interval_seconds / 60);
      await db.rpc("master_save_sync_settings", { _minutes: minutes, _retention_days: cfg.log_retention_days })
        .then(({ error }) => { if (error) console.error("restore sync settings skipped", error.message); });
      await logEvent(db, "config", "Backup da comunicação restaurado", {
        by: session.username, installation_id: cfg.installation_id, backup_created_at: check.backup.created_at,
      });
      const { data: saved } = await db.from("master_integration").select("*").eq("id", 1).single();
      return json({ integration: maskIntegration(saved) });
    }

    if (action === "prepare_new_installation") {
      const parsed = PrepareSchema.safeParse(body);
      if (!parsed.success) return json({ error: "Digite PREPARAR para confirmar." }, 400);
      const locked = await db.rpc("master_try_sync_lock", { _seconds: 120 });
      if (!locked.data) return json({ error: "Uma sincronização está em andamento. Tente em instantes." }, 409);
      // Identity first, so any cron run from here on skips as "not configured".
      await db.from("master_integration").update({ ...PREPARE_RESET, sync_lock_until: new Date(Date.now() + 120_000).toISOString() }).eq("id", 1);
      const cmds = await db.from("master_commands").delete().not("id", "is", null).select("id");
      const evs = await db.from("master_events").delete().not("id", "is", null).select("id");
      // Other Master sessions end; the operator's current session stays so the operation can finish.
      await db.from("master_sessions").delete().neq("id", session.sessionId);
      await db.from("master_integration").update({ sync_lock_until: null }).eq("id", 1);
      await logEvent(db, "config", "Ambiente preparado para nova instalação", {
        by: session.username, commands_removed: cmds.data?.length ?? 0, events_removed: evs.data?.length ?? 0,
      });
      const { data: saved } = await db.from("master_integration").select("*").eq("id", 1).single();
      return json({ integration: maskIntegration(saved) });
    }

    if (action === "bind_installation") {
      const parsed = BindSchema.safeParse(body);
      if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, 400);
      const { data: cur } = await db.from("master_integration").select("installation_id").eq("id", 1).single();
      if (cur?.installation_id) return json({ error: "Prepare a nova instalação antes de vincular outra identidade." }, 409);
      const d = parsed.data;
      await db.from("master_integration").update({
        base_url: d.base_url.replace(/\/+$/, ""), installation_id: d.installation_id.toLowerCase(),
        token_encrypted: await encryptSecret(d.token), token_last4: d.token.slice(-4),
        store_name: d.store_name || null, status: "disconnected", last_error: null,
      }).eq("id", 1);
      await logEvent(db, "config", "Nova instalação vinculada", { by: session.username, installation_id: d.installation_id.toLowerCase() });
      const creds = await loadCredentials(db);
      const reply = await masterRequest(creds!, "POST", `${PDV_API_PREFIX}/verify`, undefined, PDV_PRODUCT_HEADERS);
      const v = (reply.data ?? {}) as Record<string, unknown>;
      let ok = reply.ok;
      let message = reply.message;
      if (ok && typeof v.installation_id === "string" && v.installation_id.toLowerCase() !== creds!.installationId) {
        ok = false; message = "O Painel Master respondeu por outra instalação.";
      }
      if (ok && typeof v.product_type === "string" && v.product_type.toUpperCase() !== "PDV_SALAO") {
        ok = false; message = `A instalação pertence a outro produto (${v.product_type}).`;
      }
      await db.from("master_integration").update({
        status: ok ? "connected" : "error", last_verify_at: new Date().toISOString(),
        last_error: ok ? null : (message ?? `HTTP ${reply.status}`),
      }).eq("id", 1);
      await logEvent(db, ok ? "connection" : "failure",
        ok ? "Nova instalação validada pelo Painel Master" : `Falha ao validar a nova instalação: ${message ?? `HTTP ${reply.status}`}`,
        { by: session.username, http_status: reply.status, response: reply.data });
      const summary = ok ? await runSync(db, { force: true, by: session.username }) : null;
      return json({ ok, message, http_status: reply.status, summary });
    }

    if (action === "events") {
      const parsed = EventsSchema.safeParse(body);
      if (!parsed.success) return json({ error: "Filtro inválido" }, 400);
      let q = db.from("master_events").select("id, kind, message, details, created_at")
        .order("created_at", { ascending: false }).limit(parsed.data.limit);
      if (parsed.data.kind) q = q.eq("kind", parsed.data.kind);
      if (parsed.data.before) q = q.lt("created_at", parsed.data.before);
      const { data, error } = await q;
      if (error) throw error;
      return json({ events: data });
    }

    const simple = SimpleSchema.safeParse(body);
    if (!simple.success) return json({ error: "Ação inválida" }, 400);

    switch (simple.data.action) {
      case "overview": {
        const [{ data: integration }, { data: controls }] = await Promise.all([
          db.from("master_integration").select("*").eq("id", 1).single(),
          db.from("pdv_controls").select("*").order("key"),
        ]);
        return json({ integration: maskIntegration(integration), controls, contract_ready: true });
      }
      case "commands": {
        const { data, error } = await db.from("master_commands")
          .select("command_id, command_type, status, received_at, acked_at, executed_at, result_sent_at, result, last_error")
          .order("received_at", { ascending: false }).limit(100);
        if (error) throw error;
        return json({ commands: data });
      }
      case "disconnect": {
        await db.from("master_integration").update({
          token_encrypted: null, token_last4: null, status: "disconnected", last_error: null,
        }).eq("id", 1);
        await logEvent(db, "connection", "Integração desconectada; token removido", { by: session.username });
        return json({ success: true });
      }
      case "test_connection":
      case "reconnect": {
        // PDV Salão route published by the Master: POST {PDV_API_PREFIX}/verify with X-Product. No body: none is defined.
        const creds = await loadCredentials(db).catch(() => "unreadable" as const);
        if (creds === "unreadable") {
          return json({ error: "O token salvo não pode ser lido com a chave de criptografia atual. Salve o token novamente acima." }, 409);
        }
        if (!creds) return json({ error: "Salve a URL, o ID da instalação e o token antes de testar." }, 400);
        const reply = await masterRequest(creds, "POST", `${PDV_API_PREFIX}/verify`, undefined, PDV_PRODUCT_HEADERS);
        const d = (reply.data ?? {}) as Record<string, unknown>;
        let ok = reply.ok;
        let message = reply.message;
        // Refuse a reply that identifies another product or another installation.
        if (ok && typeof d.product_type === "string" && d.product_type.toUpperCase() !== "PDV_SALAO") {
          ok = false;
          message = `A instalação pertence a outro produto (${d.product_type}).`;
        }
        if (ok && typeof d.installation_id === "string" && d.installation_id.toLowerCase() !== creds.installationId) {
          ok = false;
          message = "O Painel Master respondeu por outra instalação.";
        }
        const now = new Date().toISOString();
        await db.from("master_integration").update({
          status: ok ? "connected" : "error",
          last_verify_at: now,
          last_error: ok ? null : (message ?? `HTTP ${reply.status}`),
        }).eq("id", 1);
        await logEvent(db, ok ? "connection" : "failure",
          ok ? "Instalação validada pelo Painel Master" : `Falha ao validar a instalação: ${message ?? `HTTP ${reply.status}`}`,
          { by: session.username, action: simple.data.action, http_status: reply.status, response: reply.data });
        return json({ ok, http_status: reply.status, message, response: reply.data });
      }
      case "pdv_bridge": {
        // Opens a PDV session for the first super administrator (oldest admin profile) so the Master area
        // can show Relatórios, Minha Assinatura and Sistema without a PDV login. No password is read or changed.
        const { data: owner } = await db.from("profiles").select("user_id")
          .eq("role", "admin").order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (!owner?.user_id) return json({ error: "Nenhum administrador do PDV foi encontrado." }, 404);
        const { data: u, error: uErr } = await db.auth.admin.getUserById(owner.user_id);
        if (uErr || !u?.user?.email) return json({ error: "A conta do administrador do PDV não foi encontrada." }, 404);
        const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
        const tokenHash = link?.properties?.hashed_token;
        if (linkErr || !tokenHash) throw linkErr ?? new Error("link_failed");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const url = Deno.env.get("SUPABASE_URL");
        if (!anonKey || !url) throw new Error("server_misconfigured");
        const pub = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: verified, error: vErr } = await pub.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
        if (vErr || !verified?.session) throw vErr ?? new Error("verify_failed");
        await logEvent(db, "auth_bridge", "Área Master abriu acesso aos dados do PDV", { by: session.username });
        return json({
          access_token: verified.session.access_token,
          refresh_token: verified.session.refresh_token,
        });
      }
      case "cleanup_now": {
        const { data, error } = await db.rpc("master_cleanup_logs");
        if (error) throw error;
        await logEvent(db, "config", "Limpeza do histórico executada manualmente", { by: session.username, result: data });
        return json({ ok: true, result: data });
      }
      case "sync_now": {
        const summary = await runSync(db, { force: true, by: session.username });
        if (summary.skipped === "busy") return json({ error: "Uma sincronização já está em andamento. Tente em instantes." }, 409);
        if (summary.skipped === "not_configured") return json({ error: "Salve a URL, o ID da instalação e o token antes de sincronizar." }, 400);
        if (summary.skipped === "token_unreadable") return json({ error: summary.errors[0] }, 409);
        return json({ ok: summary.errors.length === 0, summary });
      }
    }
  } catch (err) {
    console.error("master-admin error", err instanceof Error ? err.message : err);
    return json({ error: "Erro interno na área Master" }, 500);
  }
});
