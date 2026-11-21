// Automatic sync entrypoint (called every minute by pg_cron). Takes no input;
// interval, lock and credentials are all enforced server-side by runSync.
import { json, corsHeaders, serviceClient } from "../_shared/master.ts";
import { runSync } from "../_shared/sync.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const summary = await runSync(serviceClient(), { by: "automatico" });
    // Only step status is returned; full replies stay in master_events.
    return json({
      skipped: summary.skipped ?? null,
      heartbeat: summary.heartbeat?.ok ?? null,
      commands: summary.commands ? { ok: summary.commands.ok, received: summary.commands.received, processed: summary.commands.processed } : null,
      report: summary.report?.ok ?? null,
      failures: summary.errors.length,
    });
  } catch (err) {
    console.error("master-sync error", err instanceof Error ? err.message : err);
    return json({ error: "Erro na sincronização" }, 500);
  }
});
