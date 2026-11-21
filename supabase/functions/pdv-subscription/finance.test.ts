import { assertEquals } from "jsr:@std/assert@1";
import { classify, isPaused, recordOutcome, resetPauses, foreignReply, checkoutUrl, pageQuery, UNPUBLISHED_PAUSE_MS } from "./finance.ts";
import type { MasterReply } from "../_shared/master.ts";

const r = (status: number, data: unknown, ok = false): MasterReply => ({ ok, status, data, message: null });
const INST = "11111111-2222-3333-4444-555555555555";

Deno.test("only endpoint_not_found means not published", () => {
  assertEquals(classify(r(404, { code: "endpoint_not_found" })), "not_published");
  assertEquals(classify(r(404, { code: "charge_not_found" })), "not_found");
  assertEquals(classify(r(404, { code: "subscription_not_found" })), "not_found");
  assertEquals(classify(r(404, null)), "not_found");
});

Deno.test("auth, installation, temporary and unexpected errors are told apart", () => {
  assertEquals(classify(r(401, { code: "invalid_token" })), "auth_failed");
  assertEquals(classify(r(403, { code: "installation_not_allowed" })), "unauthorized_installation");
  assertEquals(classify(r(0, null)), "temporary_error");
  assertEquals(classify(r(503, null)), "temporary_error");
  assertEquals(classify(r(429, null)), "temporary_error");
  assertEquals(classify(r(422, { code: "x" })), "error");
});

Deno.test("an empty list is a normal answer, not an unpublished service", () => {
  assertEquals(classify(r(200, { ok: true, items: [], total: 0 }, true)), "ok");
});

Deno.test("each service is paused on its own", () => {
  resetPauses();
  const now = 1_000_000;
  recordOutcome("charges", r(404, { code: "endpoint_not_found" }), now);
  assertEquals(isPaused("charges", now + 1), true);
  assertEquals(isPaused("payments", now + 1), false);
  assertEquals(isPaused("subscription", now + 1), false);
  assertEquals(isPaused("charges", now + UNPUBLISHED_PAUSE_MS + 1), false);
});

Deno.test("a not-found or temporary failure does not pause the service", () => {
  resetPauses();
  recordOutcome("payments", r(404, { code: "charge_not_found" }));
  recordOutcome("charges", r(503, null));
  assertEquals(isPaused("payments"), false);
  assertEquals(isPaused("charges"), false);
});

Deno.test("replies from another installation or product are refused", () => {
  assertEquals(foreignReply({ installation_id: INST, product: "pdv_salao", items: [] }, INST), null);
  assertEquals(foreignReply({ installation_id: "99999999-2222-3333-4444-555555555555", items: [] }, INST), "outra instalação");
  assertEquals(foreignReply({ installation_id: INST, product: "pdv_restaurante" }, INST), "outro produto (pdv_restaurante)");
});

Deno.test("checkout link must be https checkout_url", () => {
  assertEquals(checkoutUrl({ checkout_url: "https://mp.example/x" }), "https://mp.example/x");
  assertEquals(checkoutUrl({ charge: { checkout_url: "https://mp.example/y" } }), "https://mp.example/y");
  assertEquals(checkoutUrl({ checkout_url: "http://mp.example/x" }), null);
  assertEquals(checkoutUrl({ url: "https://mp.example/x" }), null);
});

Deno.test("page parameter is only sent for valid pages after the first", () => {
  assertEquals(pageQuery(undefined), "");
  assertEquals(pageQuery(1), "");
  assertEquals(pageQuery(3), "?page=3");
  assertEquals(pageQuery(-2), "");
  assertEquals(pageQuery("2; drop"), "");
});
