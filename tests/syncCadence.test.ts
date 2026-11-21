// Run with: deno test tests/
import { assertEquals } from "jsr:@std/assert@1";
import { shouldSyncNow } from "../supabase/functions/_shared/sync.ts";

const last = "2026-11-20T18:00:07Z";
const at = (s: number) => new Date(last).getTime() + s * 1000;

Deno.test("300s interval: run after 270s is accepted", () => {
  assertEquals(shouldSyncNow({ lastSyncAt: last, intervalSeconds: 300, now: at(270) }), true);
});
Deno.test("300s interval: run before 270s is skipped", () => {
  assertEquals(shouldSyncNow({ lastSyncAt: last, intervalSeconds: 300, now: at(269) }), false);
});
Deno.test("300s interval: cron fire 293s later is accepted", () => {
  assertEquals(shouldSyncNow({ lastSyncAt: last, intervalSeconds: 300, now: at(293) }), true);
});
Deno.test("force: true always runs", () => {
  assertEquals(shouldSyncNow({ force: true, lastSyncAt: last, intervalSeconds: 300, now: at(1) }), true);
});
