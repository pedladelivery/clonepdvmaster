// License suspension decided by the Painel Master (mirrored in pdv_license_state).
export const LICENSE_SUSPENDED_TITLE = "Estabelecimento temporariamente suspenso";
export const LICENSE_SUSPENDED_TEXT = "Este estabelecimento está temporariamente suspenso.";
export const LICENSE_SUSPENDED_DETAIL =
  "O acesso operacional está bloqueado. Consulte sua assinatura para verificar a situação e as opções disponíveis.";

const PATTERN = /PDV_LICENSE_SUSPENDED|license_suspended/;

/** True when a database or function refusal was caused by the suspended license. */
export function isLicenseSuspendedError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") return PATTERN.test(error);
  const e = error as { message?: string; details?: string; code?: string; error?: string };
  return PATTERN.test([e.message, e.details, e.code, e.error].filter(Boolean).join(" "));
}

export function licenseSuspendedMessage(): string {
  return `${LICENSE_SUSPENDED_TEXT} ${LICENSE_SUSPENDED_DETAIL}`;
}
