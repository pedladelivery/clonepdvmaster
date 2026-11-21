// Run with: deno test tests/
import { assertEquals } from "jsr:@std/assert@1";
import { licenseFromMaster, licenseSuspendedBody } from "../supabase/functions/_shared/license.ts";
import { isLicenseSuspendedError } from "../src/lib/license.ts";

Deno.test("license.status 'suspended' from the Master means suspended", () => {
  assertEquals(licenseFromMaster({ license: { status: "suspended", active: false } }), "suspended");
});

Deno.test("suspended === true means suspended", () => {
  assertEquals(licenseFromMaster({ suspended: true, license: { status: "active" } }), "suspended");
  assertEquals(licenseFromMaster({ suspension: { suspended: true } }), "suspended");
});

Deno.test("operational === false alone means suspended", () => {
  assertEquals(licenseFromMaster({ operational: false }), "suspended");
});

Deno.test("operational === false with an active, not suspended license is not a suspension", () => {
  assertEquals(licenseFromMaster({ operational: false, suspended: false, license: { status: "active" } }), null);
});

Deno.test("the real active heartbeat reply means active", () => {
  const reply = {
    ok: true, operational: true, suspended: false,
    license: { active: true, status: "active", valid_until: "2026-12-13" },
    suspension: { suspended: false, message: "", reason: null },
  };
  assertEquals(licenseFromMaster(reply), "active");
});

Deno.test("a reply without license indicators keeps the stored state", () => {
  assertEquals(licenseFromMaster({ ok: true }), null);
  assertEquals(licenseFromMaster(null), null);
});

Deno.test("protected functions answer with a structured license_suspended body", () => {
  const body = licenseSuspendedBody();
  assertEquals(body.code, "license_suspended");
  assertEquals(body.subscription_available, true);
});

Deno.test("database refusals caused by the license are recognised", () => {
  assertEquals(isLicenseSuspendedError({ code: "42501", message: "PDV_LICENSE_SUSPENDED: Este estabelecimento está temporariamente suspenso." }), true);
  assertEquals(isLicenseSuspendedError({ message: "PDV_BLOCKED:sales:" }), false);
});
