// License suspension rules shared by the Master sync and the protected edge functions.
// The Painel Master is the only authority: the PDV only mirrors what it confirms.

export type LicenseSignal = "active" | "suspended" | null;

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const lower = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null);

/**
 * Reads the license state from a Master reply (heartbeat or similar).
 * Returns null when the reply carries no explicit license indicator, so the stored state is kept.
 */
export function licenseFromMaster(data: unknown): LicenseSignal {
  const d = obj(data);
  const lic = obj(d.license);
  const suspension = obj(d.suspension);
  const status = lower(lic.status) ?? lower(d.license_status);

  if (status === "suspended" || d.suspended === true || suspension.suspended === true) return "suspended";

  const explicitlyNotSuspended = d.suspended === false || suspension.suspended === false;
  // operational === false only means suspension when nothing says the license is fine.
  if (d.operational === false && status !== "active" && lic.active !== true && !explicitlyNotSuspended) {
    return "suspended";
  }

  if ((status === "active" || (status === null && lic.active === true)) && d.operational !== false) return "active";
  return null;
}

export const LICENSE_SUSPENDED_MESSAGE =
  "Este estabelecimento está temporariamente suspenso. O acesso operacional está bloqueado. Consulte Minha Assinatura para verificar a situação e as opções disponíveis.";

/** Structured body returned with HTTP 403 by protected operations while suspended. */
export function licenseSuspendedBody() {
  return {
    error: LICENSE_SUSPENDED_MESSAGE,
    code: "license_suspended",
    license_status: "suspended",
    subscription_available: true,
  };
}

// deno-lint-ignore no-explicit-any
export async function isLicenseSuspended(db: any): Promise<boolean> {
  const { data, error } = await db.from("master_integration").select("license_status").eq("id", 1).maybeSingle();
  if (error) throw new Error("Falha ao verificar a licença");
  return data?.license_status === "suspended";
}
