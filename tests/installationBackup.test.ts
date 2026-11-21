import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildBackup, verifyBackup, PREPARE_RESET } from "../supabase/functions/_shared/installation.ts";

const cfg = {
  base_url: "https://painel.example", installation_id: "008284b6-e8be-4a66-a483-a7d0318c02f9",
  token_encrypted: "aXY=:Y3Q=", token_last4: "ABCD", store_name: "Loja", sync_interval_seconds: 300, log_retention_days: 7,
};

Deno.test("backup never contains the plain token or the key", async () => {
  const text = JSON.stringify(await buildBackup("chave-secreta", cfg));
  assert(!text.includes("chave-secreta"));
  assert(!/"token"\s*:/.test(text));
});

Deno.test("valid backup verifies with the same key", async () => {
  assert((await verifyBackup("k1", await buildBackup("k1", cfg))).ok);
});

Deno.test("backup from another key is refused", async () => {
  assertEquals((await verifyBackup("k2", await buildBackup("k1", cfg))).ok, false);
});

Deno.test("tampered backup is refused", async () => {
  const b = await buildBackup("k1", cfg);
  b.config.installation_id = "11111111-1111-1111-1111-111111111111";
  assertEquals((await verifyBackup("k1", b)).ok, false);
});

Deno.test("preparing keeps license status and sync settings", () => {
  assert(!("license_status" in PREPARE_RESET));
  assert(!("sync_interval_seconds" in PREPARE_RESET));
  assert(!("base_url" in PREPARE_RESET));
  assertEquals(PREPARE_RESET.installation_id, null);
});
