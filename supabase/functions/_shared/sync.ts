// Painel Master sync for PDV Salão: heartbeat, pending commands, ACK, result and reports.
// Routes are the six published under PDV_API_PREFIX (verify is in master-admin).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  loadCredentials, masterRequest, logEvent, sanitize, PDV_API_PREFIX, PDV_PRODUCT_HEADERS,
  type IntegrationCreds, type MasterReply,
} from "./master.ts";
import { licenseFromMaster } from "./license.ts";

export const APP_VERSION = "pdv-salao-1.0.0";
const PRODUCT = "PDV_SALAO";
const REPORT_EVERY_MS = 60 * 60 * 1000; // hourly summary unless the Master asks earlier (reports.sync)
const MIN_INTERVAL_S = 30;
const MAX_INTERVAL_S = 3600;

export const SUPPORTED_COMMANDS = [
  "admin.block", "admin.unblock", "tables.block", "tables.unblock", "sales.block", "sales.unblock",
  "license.activate", "license.suspend", "status.check", "reports.sync",
] as const;
type CommandType = typeof SUPPORTED_COMMANDS[number];

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const msg = (r: MasterReply) => r.message ?? `HTTP ${r.status}`;

export interface SyncStep { ok: boolean; http_status: number; message: string | null }
export interface SyncSummary {
  skipped?: string;
  heartbeat?: SyncStep;
  commands?: SyncStep & { received: number; processed: number; ignored: number };
  report?: SyncStep | null;
  errors: string[];
}

/** Normalised view of one command as listed by the Master. */
interface MasterCommand {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  installationId: string | null;
  product: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
}

function parseCommands(data: unknown): MasterCommand[] {
  const d = obj(data);
  const list = Array.isArray(data) ? data
    : Array.isArray(d.commands) ? d.commands
    : Array.isArray(d.data) ? d.data
    : Array.isArray(obj(d.data).commands) ? obj(d.data).commands as unknown[]
    : Array.isArray(d.items) ? d.items : [];
  const out: MasterCommand[] = [];
  for (const item of list) {
    const c = obj(item);
    const id = str(c.id) ?? str(c.command_id);
    const type = str(c.type) ?? str(c.command_type) ?? str(c.command) ?? str(c.action);
    if (!id || !type) continue;
    out.push({
      id,
      type: type.toLowerCase(),
      payload: obj(c.payload ?? c.params ?? c.data),
      installationId: str(c.installation_id)?.toLowerCase() ?? null,
      product: (str(c.product_type) ?? str(c.product))?.toUpperCase() ?? null,
      createdAt: str(c.created_at),
      raw: c,
    });
  }
  return out;
}

async function controlsState(db: SupabaseClient) {
  const { data } = await db.from("pdv_controls").select("key, blocked, message, changed_at");
  const out: Record<string, { blocked: boolean; message: string | null; changed_at: string }> = {};
  for (const r of data ?? []) out[r.key] = { blocked: r.blocked, message: r.message, changed_at: r.changed_at };
  return out;
}

/** Sales summary for one São Paulo calendar day (YYYY-MM-DD). */
export async function buildDailyReport(db: SupabaseClient, day: string) {
  const start = new Date(`${day}T00:00:00-03:00`).toISOString();
  const end = new Date(new Date(`${day}T00:00:00-03:00`).getTime() + 86_400_000).toISOString();
  const rows: { total: number; status: string | null; payment_method: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("sales").select("total, status, payment_method")
      .gte("created_at", start).lt("created_at", end).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const completed = rows.filter((r) => (r.status ?? "completed") === "completed");
  const cancelled = rows.filter((r) => r.status === "cancelled");
  const pending = rows.filter((r) => r.status === "pending");
  const byMethod = new Map<string, { count: number; total: number }>();
  for (const r of completed) {
    const k = r.payment_method ?? "nao_informado";
    const m = byMethod.get(k) ?? { count: 0, total: 0 };
    m.count++; m.total += Number(r.total) || 0; byMethod.set(k, m);
  }
  const total = completed.reduce((s, r) => s + (Number(r.total) || 0), 0);
  return {
    report_type: "daily_sales_summary",
    period: { date: day, start, end, timezone: "America/Sao_Paulo" },
    sales_count: completed.length,
    sales_total: round(total),
    average_ticket: completed.length ? round(total / completed.length) : 0,
    cancelled_count: cancelled.length,
    cancelled_total: round(cancelled.reduce((s, r) => s + (Number(r.total) || 0), 0)),
    open_orders_count: pending.length,
    by_payment_method: [...byMethod.entries()].map(([method, v]) => ({ method, count: v.count, total: round(v.total) })),
  };
}

const spDay = (offsetDays = 0) =>
  new Date(Date.now() - 3 * 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

async function sendReport(db: SupabaseClient, creds: IntegrationCreds, reason: string) {
  const reports = [await buildDailyReport(db, spDay(0))];
  // Shortly after midnight also close the previous day.
  if (new Date(Date.now() - 3 * 3600_000).getUTCHours() < 2) reports.unshift(await buildDailyReport(db, spDay(1)));
  const body = {
    installation_id: creds.installationId,
    product_type: PRODUCT,
    generated_at: new Date().toISOString(),
    reason,
    reports,
  };
  const res = await masterRequest(creds, "POST", `${PDV_API_PREFIX}/installations/{id}/reports`, body, PDV_PRODUCT_HEADERS);
  await logEvent(db, res.ok ? "report" : "failure",
    res.ok ? "Relatório enviado ao Painel Master" : `Falha ao enviar relatório: ${msg(res)}`,
    { reason, http_status: res.status, response: res.data, sent: sanitize(body) });
  if (res.ok) await db.from("master_integration").update({ last_report_at: new Date().toISOString() }).eq("id", 1);
  return res;
}

async function setControl(db: SupabaseClient, key: "admin" | "tables" | "sales", blocked: boolean, payload: Record<string, unknown>) {
  const message = str(payload.message) ?? str(payload.reason);
  const { error } = await db.from("pdv_controls").update({
    blocked, message: blocked ? message : null, changed_at: new Date().toISOString(),
    changed_by: "painel_master", source: "master",
  }).eq("key", key);
  if (error) throw new Error(`Falha ao gravar controle ${key}`);
  return { key, blocked, message: blocked ? message : null };
}

async function execute(db: SupabaseClient, creds: IntegrationCreds, cmd: MasterCommand): Promise<Record<string, unknown>> {
  const type = cmd.type as CommandType;
  switch (type) {
    case "admin.block": case "admin.unblock":
    case "tables.block": case "tables.unblock":
    case "sales.block": case "sales.unblock": {
      const [key, verb] = type.split(".") as ["admin" | "tables" | "sales", string];
      return { control: await setControl(db, key, verb === "block", cmd.payload) };
    }
    case "license.activate": case "license.suspend": {
      const license_status = type === "license.activate" ? "active" : "suspended";
      const { error } = await db.from("master_integration").update({ license_status }).eq("id", 1);
      if (error) throw new Error("Falha ao gravar a licença");
      return { license_status };
    }
    case "status.check": {
      const { data: integ } = await db.from("master_integration")
        .select("license_status, last_heartbeat_at, last_sync_at, last_report_at").eq("id", 1).single();
      return { app_version: APP_VERSION, controls: await controlsState(db), ...integ, checked_at: new Date().toISOString() };
    }
    case "reports.sync": {
      const res = await sendReport(db, creds, "command:reports.sync");
      if (!res.ok) throw new Error(`Relatório recusado pelo Master: ${msg(res)}`);
      return { report_sent: true, http_status: res.status };
    }
  }
}

async function sendResult(db: SupabaseClient, creds: IntegrationCreds, commandId: string, success: boolean, result: Record<string, unknown>, error: string | null) {
  const body = {
    installation_id: creds.installationId,
    status: success ? "success" : "failed",
    success,
    result,
    error,
    executed_at: new Date().toISOString(),
  };
  const res = await masterRequest(creds, "POST", `${PDV_API_PREFIX}/commands/${encodeURIComponent(commandId)}/result`, body, PDV_PRODUCT_HEADERS);
  if (res.ok) {
    await db.from("master_commands").update({ status: success ? "completed" : "failed", result_sent_at: new Date().toISOString(), last_error: error })
      .eq("command_id", commandId);
  } else {
    await db.from("master_commands").update({ last_error: `Resultado não entregue: ${msg(res)}` }).eq("command_id", commandId);
  }
  await logEvent(db, res.ok ? "command" : "failure",
    res.ok ? `Resultado do comando ${commandId} enviado (${success ? "sucesso" : "falha"})` : `Falha ao enviar resultado do comando ${commandId}: ${msg(res)}`,
    { command_id: commandId, http_status: res.status, response: res.data, sent: sanitize(body) });
  return res.ok;
}

/** Receive → ACK → execute once → result. Safe to call again for the same command. */
async function processCommand(db: SupabaseClient, creds: IntegrationCreds, cmd: MasterCommand): Promise<"processed" | "ignored"> {
  if (cmd.installationId && cmd.installationId !== creds.installationId) {
    await logEvent(db, "failure", `Comando ${cmd.id} ignorado: destinado a outra instalação`, { command_id: cmd.id, installation_id: cmd.installationId });
    return "ignored";
  }
  if (cmd.product && cmd.product !== PRODUCT) {
    await logEvent(db, "failure", `Comando ${cmd.id} ignorado: destinado a outro produto (${cmd.product})`, { command_id: cmd.id });
    return "ignored";
  }

  // Register receipt (idempotent on command_id).
  await db.from("master_commands").upsert({
    command_id: cmd.id, installation_id: creds.installationId, command_type: cmd.type,
    payload: sanitize(cmd.payload), master_created_at: cmd.createdAt, status: "received",
  }, { onConflict: "command_id", ignoreDuplicates: true });
  const { data: row } = await db.from("master_commands").select("*").eq("command_id", cmd.id).single();
  if (!row) return "ignored";
  if (row.status === "completed" || row.status === "failed") return "ignored"; // already finished
  if (row.attempts >= 10 && !row.executed_at) return "ignored";
  await db.from("master_commands").update({ attempts: (row.attempts ?? 0) + 1 }).eq("command_id", cmd.id);
  if (row.status === "received") await logEvent(db, "command", `Comando ${cmd.type} recebido`, { command_id: cmd.id });

  if (!row.acked_at) {
    const ack = await masterRequest(creds, "POST", `${PDV_API_PREFIX}/commands/${encodeURIComponent(cmd.id)}/ack`,
      { installation_id: creds.installationId, received_at: row.received_at }, PDV_PRODUCT_HEADERS);
    await logEvent(db, ack.ok ? "command" : "failure",
      ack.ok ? `Recebimento do comando ${cmd.id} confirmado` : `Falha no ACK do comando ${cmd.id}: ${msg(ack)}`,
      { command_id: cmd.id, http_status: ack.status, response: ack.data });
    if (!ack.ok) {
      await db.from("master_commands").update({ last_error: `ACK: ${msg(ack)}` }).eq("command_id", cmd.id);
      return "processed"; // retried next cycle, nothing executed yet
    }
    await db.from("master_commands").update({ status: "acked", acked_at: new Date().toISOString() }).eq("command_id", cmd.id);
  }

  // Execute exactly once; on retry resend the stored result.
  if (!row.executed_at) {
    const known = (SUPPORTED_COMMANDS as readonly string[]).includes(cmd.type);
    let success = false; let result: Record<string, unknown> = {}; let error: string | null = null;
    if (!known) {
      error = `Comando não suportado pelo PDV Salão: ${cmd.type}`;
    } else {
      try { result = await execute(db, creds, cmd); success = true; }
      catch (e) { error = e instanceof Error ? e.message : "Falha ao executar"; }
    }
    await db.from("master_commands").update({
      status: "executed", executed_at: new Date().toISOString(),
      result: { success, data: sanitize(result), error }, last_error: error,
    }).eq("command_id", cmd.id);
    await logEvent(db, success ? "command" : "failure",
      success ? `Comando ${cmd.type} executado` : `Comando ${cmd.type} não executado: ${error}`, { command_id: cmd.id, result: sanitize(result) });
    await sendResult(db, creds, cmd.id, success, result, error);
  } else {
    const stored = obj(row.result);
    await sendResult(db, creds, cmd.id, stored.success === true, obj(stored.data), str(stored.error));
  }
  return "processed";
}

/** Results executed earlier whose delivery failed and which the Master no longer lists. */
async function retryUndelivered(db: SupabaseClient, creds: IntegrationCreds, listed: Set<string>) {
  const { data } = await db.from("master_commands").select("command_id, result")
    .eq("status", "executed").is("result_sent_at", null).limit(20);
  for (const r of data ?? []) {
    if (listed.has(r.command_id)) continue;
    const stored = obj(r.result);
    await sendResult(db, creds, r.command_id, stored.success === true, obj(stored.data), str(stored.error));
  }
}

/** Cron slack: a run is accepted once `interval - SYNC_SLACK_S` seconds passed since the last sync. */
export const SYNC_SLACK_S = 30;
export function shouldSyncNow(o: { force?: boolean; lastSyncAt: string | null | undefined; intervalSeconds: number; now: number }): boolean {
  if (o.force || !o.lastSyncAt) return true;
  return o.now - new Date(o.lastSyncAt).getTime() >= (o.intervalSeconds - SYNC_SLACK_S) * 1000;
}

export async function runSync(db: SupabaseClient, opts: { force?: boolean; by: string }): Promise<SyncSummary> {
  const summary: SyncSummary = { errors: [] };
  const { data: integ } = await db.from("master_integration")
    .select("status, last_sync_at, last_report_at, sync_interval_seconds, token_encrypted").eq("id", 1).single();
  if (!integ?.token_encrypted) return { ...summary, skipped: "not_configured" };

  const interval = Math.min(MAX_INTERVAL_S, Math.max(MIN_INTERVAL_S, integ.sync_interval_seconds ?? 60));
  if (!shouldSyncNow({ force: opts.force, lastSyncAt: integ.last_sync_at, intervalSeconds: interval, now: Date.now() })) {
    return { ...summary, skipped: "interval" };
  }
  const { data: locked } = await db.rpc("master_try_sync_lock", { _seconds: 90 });
  if (!locked) return { ...summary, skipped: "busy" };

  try {
    let creds: IntegrationCreds | null;
    try { creds = await loadCredentials(db); }
    catch {
      const error = "O token salvo não pode ser lido com a chave de criptografia atual. Salve o token novamente na aba Integração.";
      await db.from("master_integration").update({ status: "error", last_error: error, last_sync_error_at: new Date().toISOString() }).eq("id", 1);
      return { ...summary, skipped: "token_unreadable", errors: [error] };
    }
    if (!creds) return { ...summary, skipped: "not_configured" };

    // 1) Heartbeat
    const { data: integNow } = await db.from("master_integration").select("license_status").eq("id", 1).single();
    const hbBody = {
      installation_id: creds.installationId,
      product_type: PRODUCT,
      status: "online",
      app_version: APP_VERSION,
      sent_at: new Date().toISOString(),
      license_status: integNow?.license_status ?? null,
      controls: await controlsState(db),
    };
    const hb = await masterRequest(creds, "POST", `${PDV_API_PREFIX}/installations/{id}/heartbeat`, hbBody, PDV_PRODUCT_HEADERS);
    summary.heartbeat = { ok: hb.ok, http_status: hb.status, message: hb.message };
    const now = new Date().toISOString();
    if (hb.ok) {
      // The Master's reply confirms the license state; only explicit indicators change it.
      const signal = licenseFromMaster(hb.data);
      const licenseUpdate = signal && signal !== integNow?.license_status ? { license_status: signal } : {};
      await db.from("master_integration").update({ last_heartbeat_at: now, status: "connected", ...licenseUpdate }).eq("id", 1);
      if (licenseUpdate.license_status) {
        await logEvent(db, "license", signal === "suspended" ? "Licença suspensa confirmada pelo heartbeat do Painel Master" : "Licença ativa confirmada pelo heartbeat do Painel Master",
          { by: opts.by, license_status: signal, previous_license_status: integNow?.license_status ?? null });
      }
    } else summary.errors.push(`Heartbeat: ${msg(hb)}`);
    await logEvent(db, hb.ok ? "heartbeat" : "failure", hb.ok ? "Heartbeat enviado" : `Falha no heartbeat: ${msg(hb)}`,
      { by: opts.by, http_status: hb.status, response: hb.data, ...(hb.ok ? {} : { sent: sanitize(hbBody) }) });

    // 2) Pending commands → ACK → execute → result
    const list = await masterRequest(creds, "GET", `${PDV_API_PREFIX}/installations/{id}/commands`, undefined, PDV_PRODUCT_HEADERS);
    const commands = list.ok ? parseCommands(list.data) : [];
    let processed = 0; let ignored = 0;
    if (list.ok) {
      await db.from("master_integration").update({ last_commands_at: new Date().toISOString() }).eq("id", 1);
      if (commands.length) await logEvent(db, "command", `${commands.length} comando(s) pendente(s) recebido(s)`, { response: list.data });
      for (const cmd of commands) {
        try { (await processCommand(db, creds, cmd)) === "processed" ? processed++ : ignored++; }
        catch (e) { summary.errors.push(`Comando ${cmd.id}: ${e instanceof Error ? e.message : "erro"}`); }
      }
      await retryUndelivered(db, creds, new Set(commands.map((c) => c.id)));
    } else {
      summary.errors.push(`Comandos: ${msg(list)}`);
      await logEvent(db, "failure", `Falha ao consultar comandos: ${msg(list)}`, { http_status: list.status, response: list.data });
    }
    summary.commands = { ok: list.ok, http_status: list.status, message: list.message, received: commands.length, processed, ignored };

    // 3) Periodic report
    const { data: afterCmds } = await db.from("master_integration").select("last_report_at").eq("id", 1).single();
    const lastReport = afterCmds?.last_report_at ? new Date(afterCmds.last_report_at).getTime() : 0;
    summary.report = null;
    if (opts.force || Date.now() - lastReport >= REPORT_EVERY_MS) {
      try {
        const rep = await sendReport(db, creds, opts.force ? "manual" : "scheduled");
        summary.report = { ok: rep.ok, http_status: rep.status, message: rep.message };
        if (!rep.ok) summary.errors.push(`Relatório: ${msg(rep)}`);
      } catch (e) {
        summary.errors.push(`Relatório: ${e instanceof Error ? e.message : "erro ao montar"}`);
      }
    }

    // Failures never touch the saved installation or the controls' last valid state.
    const failed = summary.errors.length > 0;
    await db.from("master_integration").update({
      last_sync_at: new Date().toISOString(),
      ...(failed
        ? { last_error: summary.errors.join(" | ").slice(0, 500), last_sync_error_at: new Date().toISOString(), ...(hb.ok ? {} : { status: "error" }) }
        : { last_error: null }),
    }).eq("id", 1);
    return summary;
  } finally {
    await db.from("master_integration").update({ sync_lock_until: null }).eq("id", 1);
  }
}
