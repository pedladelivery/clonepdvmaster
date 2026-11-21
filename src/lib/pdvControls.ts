import { isLicenseSuspendedError, licenseSuspendedMessage } from "@/lib/license";

export type PdvControlKey = "admin" | "tables" | "sales";

export interface PdvControl {
  key: PdvControlKey;
  blocked: boolean;
  message: string | null;
  changed_at: string;
  changed_by: string | null;
  source: string;
}

export const PDV_CONTROL_LABELS: Record<PdvControlKey, string> = {
  admin: "Acesso administrativo",
  tables: "Abertura e atendimento de mesas",
  sales: "Recebimento de vendas",
};

const DEFAULT_BLOCK_MESSAGES: Record<PdvControlKey, string> = {
  admin: "O acesso administrativo está bloqueado pelo Painel Master.",
  tables: "A abertura de novas mesas e atendimentos está bloqueada pelo Painel Master.",
  sales: "O recebimento de vendas está bloqueado pelo Painel Master.",
};

/** Screens that count as administration and close while the admin control is blocked. */
export const ADMIN_LOCKED_AREAS = ["catalog", "suppliers", "sellers", "stock", "settings"] as const;

export function blockedMessage(key: PdvControlKey, masterMessage?: string | null): string {
  const custom = (masterMessage ?? "").trim();
  return custom ? `${DEFAULT_BLOCK_MESSAGES[key]} ${custom}` : DEFAULT_BLOCK_MESSAGES[key];
}

const BLOCK_PATTERN = /PDV_BLOCKED:(admin|tables|sales):?([^\n]*)/;

/** Translates a database refusal raised by a PDV lock into a readable message, or null. */
export function pdvBlockedMessage(error: unknown): string | null {
  const text =
    typeof error === "string"
      ? error
      : (error as { message?: string } | null)?.message ?? "";
  if (isLicenseSuspendedError(error)) return licenseSuspendedMessage();
  const match = BLOCK_PATTERN.exec(text);
  if (!match) return null;
  return blockedMessage(match[1] as PdvControlKey, match[2]);
}
