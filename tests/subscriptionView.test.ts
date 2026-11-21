// Run with: deno test tests/
import { assertEquals } from "jsr:@std/assert@1";
import { canPayCharge, chargeNotice, readSubscription } from "../src/lib/subscriptionView.ts";

const charge = (status: string, payable: boolean) => ({ id: "09aa19a3-c425-4342-9b93-b3a608454491", status, payable });

Deno.test("a pending payable charge offers payment", () => {
  assertEquals(canPayCharge(charge("pending", true)), true);
});

Deno.test("a paid charge never offers payment, even if marked payable", () => {
  assertEquals(canPayCharge(charge("paid", true)), false);
  assertEquals(chargeNotice(charge("paid", false))?.text, "Pagamento confirmado pelo Painel Master.");
});

Deno.test("a cancelled charge never offers payment", () => {
  assertEquals(canPayCharge(charge("cancelled", true)), false);
  assertEquals(canPayCharge(charge("canceled", true)), false);
});

Deno.test("a rejected payment can be retried only when the Master allows it", () => {
  assertEquals(canPayCharge(charge("rejected", true)), true);
  assertEquals(canPayCharge(charge("rejected", false)), false);
});

Deno.test("an expired charge follows the Master's payable flag", () => {
  assertEquals(canPayCharge(charge("expired", false)), false);
  assertEquals(chargeNotice(charge("expired", false))?.text, "Cobrança expirada.");
});

Deno.test("last payment is read from the Master's last_payment next to subscription", () => {
  const v = readSubscription({
    subscription: { plan_name: "PDV TESTE", amount: 1, paid_until: "2026-12-17", status: "active" },
    last_payment: { paid_at: "2026-11-15T00:55:37+00:00", amount: 1, method_label: "PIX", transaction_id: "188652381023" },
  });
  assertEquals(v.lastPaymentAt, "2026-11-15T00:55:37+00:00");
  assertEquals(v.lastPaymentAmount, 1);
  assertEquals(v.lastPaymentMethod, "PIX");
  assertEquals(v.lastPaymentTransactionId, "188652381023");
  assertEquals(v.paidUntil, "2026-12-17");
});

Deno.test("total paid is never computed when the Master does not send it", () => {
  const v = readSubscription({ subscription: { amount: 1 }, last_payment: { amount: 1, paid_at: "2026-11-15" } });
  assertEquals(v.totalPaid, undefined);
});

import { splitCharges, keepLastValid } from "../src/lib/subscriptionView.ts";
const mk = (id: string, status: string, payable = false) => ({ id, status, payable });
const ids = (rs: Record<string, unknown>[]) => rs.map((r) => r.id);

Deno.test("a pending charge is listed in current charges", () => {
  const s = splitCharges([mk("a", "pending", true)]);
  assertEquals(ids(s.current), ["a"]);
  assertEquals(ids(s.closed), []);
});

Deno.test("a paid charge leaves current charges and goes to the charge history", () => {
  const s = splitCharges([mk("a", "paid", true)]);
  assertEquals(ids(s.current), []);
  assertEquals(ids(s.closed), ["a"]);
});

Deno.test("a cancelled charge is only in the charge history", () => {
  const s = splitCharges([mk("a", "cancelled")]);
  assertEquals([ids(s.current), ids(s.closed)], [[], ["a"]]);
});

Deno.test("an expired charge is only in the charge history", () => {
  const s = splitCharges([mk("a", "expired")]);
  assertEquals([ids(s.current), ids(s.closed)], [[], ["a"]]);
});

Deno.test("an overdue charge stays in current charges", () => {
  assertEquals(ids(splitCharges([mk("a", "overdue", true)]).current), ["a"]);
});

Deno.test("an unknown status is never hidden and stays in current charges", () => {
  const s = splitCharges([mk("a", "em_revisao")]);
  assertEquals([ids(s.current), ids(s.closed)], [["a"], []]);
});

Deno.test("a new charge from the Master appears in current charges next to the closed ones", () => {
  const s = splitCharges([mk("old", "paid"), mk("new", "pending", true)]);
  assertEquals([ids(s.current), ids(s.closed)], [["new"], ["old"]]);
});

Deno.test("repeated records are shown only once", () => {
  const s = splitCharges([mk("a", "paid"), mk("a", "paid"), mk("b", "pending", true), mk("b", "pending", true)]);
  assertEquals([ids(s.current), ids(s.closed)], [["b"], ["a"]]);
});

Deno.test("a communication failure keeps the last records on screen", () => {
  const prev: { state: string; data: unknown } = { state: "ok", data: { items: [mk("p1", "approved")] } };
  const r = keepLastValid(prev, { state: "temporary_error", data: null });
  assertEquals(r.reply, prev);
  assertEquals(r.stale, true);
});

Deno.test("a new valid reply replaces the old records", () => {
  const next = { state: "ok", data: { items: [] } };
  assertEquals(keepLastValid({ state: "ok", data: { items: [mk("p1", "approved")] } }, next).reply, next);
});
