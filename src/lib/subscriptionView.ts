/**
 * Reads the subscription the Painel Master returns. The Master has not published
 * an exact format yet, so known fields are looked up under common names and every
 * other field is still shown as received. Nothing here is invented or computed.
 */
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

function at(src: Rec, path: string): unknown {
  let cur: unknown = src;
  for (const part of path.split(".")) {
    if (!isRec(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function pick(src: Rec, paths: string[], used: Set<string>): unknown {
  for (const p of paths) {
    const v = at(src, p);
    if (v !== undefined && v !== null && v !== "") {
      used.add(p.split(".")[0]);
      return v;
    }
  }
  return undefined;
}

export type SubscriptionStatus = "active" | "pending" | "overdue" | "suspended" | "cancelled" | "unknown";

export function normalizeStatus(raw: unknown): SubscriptionStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  if (["active", "ativa", "ativo", "authorized", "paid", "em_dia"].includes(s)) return "active";
  if (["pending", "pendente", "awaiting_payment", "trial"].includes(s)) return "pending";
  if (["overdue", "past_due", "vencida", "vencido", "expired", "expirada"].includes(s)) return "overdue";
  if (["suspended", "suspensa", "suspenso", "paused", "blocked"].includes(s)) return "suspended";
  if (["cancelled", "canceled", "cancelada", "cancelado"].includes(s)) return "cancelled";
  return "unknown";
}

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Ativa",
  pending: "Pendente",
  overdue: "Vencida",
  suspended: "Suspensa",
  cancelled: "Cancelada",
  unknown: "Situação informada pelo Master",
};

export interface SubscriptionView {
  plan?: unknown;
  /** Amount fixed in the contract. Preferred over the plan's current list price. */
  amount?: unknown;
  periodicity?: unknown;
  contractedAt?: unknown;
  nextDue?: unknown;
  status?: unknown;
  /** Date until which the Master says the subscription is paid. */
  paidUntil?: unknown;
  lastPaymentAt?: unknown;
  lastPaymentAmount?: unknown;
  lastPaymentMethod?: unknown;
  lastPaymentTransactionId?: unknown;
  /** Only an official total sent by the Master — never summed by the PDV. */
  totalPaid?: unknown;
  rest: Rec;
}

export function readSubscription(raw: unknown): SubscriptionView {
  const top: Rec = isRec(raw) ? raw : {};
  const root: Rec = isRec(top.subscription) ? top.subscription : top;
  // The Master sends `last_payment` next to `subscription`, not inside it.
  const lp: Rec = isRec(top.last_payment) ? top.last_payment : isRec(root.last_payment) ? root.last_payment : {};
  const none = new Set<string>();
  const used = new Set<string>(["ok", "success", "valid", "message", "code"]);
  const view: SubscriptionView = {
    plan: pick(root, ["plan_name", "plan.name", "plan", "name"], used),
    // Contracted value first: a later change in the plan price must not alter an existing contract.
    amount: pick(root, ["contracted_amount", "contracted_price", "amount", "value", "price", "plan.price"], used),
    periodicity: pick(root, ["periodicity", "billing_cycle", "cycle", "interval", "period", "plan.periodicity", "plan.interval"], used),
    contractedAt: pick(root, ["contracted_at", "started_at", "start_date", "created_at"], used),
    nextDue: pick(root, ["next_due_date", "next_due_at", "due_date", "current_period_end", "expires_at", "valid_until"], used),
    status: pick(root, ["status", "situation", "state"], used),
    paidUntil: pick(root, ["paid_until"], used),
    lastPaymentAt: pick(lp, ["paid_at"], none) ?? pick(root, ["last_payment_at", "last_paid_at", "last_payment_date"], used),
    lastPaymentAmount: pick(lp, ["amount"], none),
    lastPaymentMethod: pick(lp, ["method_label", "method"], none),
    lastPaymentTransactionId: pick(lp, ["transaction_id"], none),
    totalPaid: pick(root, ["total_paid", "amount_paid", "paid_total"], used) ?? pick(top, ["total_paid", "amount_paid", "paid_total"], none),
    rest: {},
  };
  used.add("last_payment");
  for (const [k, v] of Object.entries(root)) if (!used.has(k)) view.rest[k] = v;
  return view;
}

const PERIOD: Record<string, string> = {
  monthly: "Mensal", month: "Mensal", mensal: "Mensal",
  quarterly: "Trimestral", trimestral: "Trimestral",
  semiannual: "Semestral", semestral: "Semestral",
  yearly: "Anual", annual: "Anual", year: "Anual", anual: "Anual",
  weekly: "Semanal", semanal: "Semanal",
};

export const formatPeriod = (v: unknown) =>
  v === undefined ? undefined : PERIOD[String(v).toLowerCase()] ?? String(v);

export function formatMoney(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(v);
}

export function formatDate(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v);
  // Plain dates (YYYY-MM-DD) are shown as-is, without timezone shifting.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("pt-BR");
}

/** Charge and payment lists as the Master returns them: `items`, `page`, `per_page`, `total`. */
export interface FinanceList { items: Rec[]; page: number; perPage: number; total: number }

export function readList(raw: unknown): FinanceList {
  const root: Rec = isRec(raw) ? raw : {};
  const items = Array.isArray(root.items) ? root.items.filter(isRec) : [];
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return { items, page: num(root.page, 1), perPage: num(root.per_page, items.length || 20), total: num(root.total, items.length) };
}

const CHARGE_STATUS: Record<string, string> = {
  pending: "Pendente", paid: "Paga", overdue: "Vencida", cancelled: "Cancelada", canceled: "Cancelada",
  expired: "Expirada", refunded: "Estornada", failed: "Recusada", approved: "Aprovado", rejected: "Recusado",
  in_process: "Em análise",
};
/** Status label for a charge or payment; unknown values are shown exactly as received. */
export const financeStatusLabel = (v: unknown) =>
  v === undefined || v === null || v === "" ? undefined : CHARGE_STATUS[String(v).toLowerCase()] ?? String(v);

/** How a charge status from the Master is treated on screen. */
export type ChargeKind = "pending" | "paid" | "cancelled" | "expired" | "rejected" | "refunded" | "other";

export function chargeKind(status: unknown): ChargeKind {
  const s = String(status ?? "").trim().toLowerCase();
  if (["pending", "open", "awaiting_payment", "in_process", "overdue"].includes(s)) return "pending";
  if (["paid", "approved"].includes(s)) return "paid";
  if (["cancelled", "canceled"].includes(s)) return "cancelled";
  if (s === "expired") return "expired";
  if (["rejected", "failed"].includes(s)) return "rejected";
  if (s === "refunded") return "refunded";
  return "other";
}

/**
 * A charge can be paid only when the Master marks it `payable` and it is not already
 * paid, cancelled or refunded — a confirmed charge never offers a new payment.
 */
export function canPayCharge(c: Rec): boolean {
  const kind = chargeKind(c.status);
  if (kind === "paid" || kind === "cancelled" || kind === "refunded") return false;
  return c.payable === true && typeof c.id === "string" && c.id.length > 0;
}

export function chargeNotice(c: Rec): { tone: "ok" | "muted" | "error"; text: string } | null {
  switch (chargeKind(c.status)) {
    case "paid": return { tone: "ok", text: "Pagamento confirmado pelo Painel Master." };
    case "cancelled": return { tone: "muted", text: "Cobrança cancelada. Não pode ser paga." };
    case "refunded": return { tone: "muted", text: "Pagamento estornado pelo Painel Master." };
    case "expired": return { tone: "error", text: canPayCharge(c) ? "Cobrança expirada. O Painel Master ainda permite o pagamento." : "Cobrança expirada." };
    case "rejected": return { tone: "error", text: canPayCharge(c) ? "Pagamento não aprovado. Você pode tentar novamente." : "Pagamento não aprovado." };
    default: return null;
  }
}

/** Removes repeated records (same Master `id`) so a refresh never shows one twice. */
export function dedupeById(items: Rec[]): Rec[] {
  const seen = new Set<string>();
  return items.filter((r) => {
    if (typeof r.id !== "string" || r.id === "") return true;
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

/**
 * A charge is closed only when the Master's own status says so (paid, cancelled,
 * expired, rejected, refunded) and the Master no longer offers it for payment.
 * Unknown statuses stay open so they are never hidden.
 */
export function isChargeClosed(c: Rec): boolean {
  const kind = chargeKind(c.status);
  if (kind === "pending" || kind === "other") return false;
  return !canPayCharge(c);
}

export function splitCharges(items: Rec[]): { current: Rec[]; closed: Rec[] } {
  const current: Rec[] = [];
  const closed: Rec[] = [];
  for (const c of dedupeById(items)) (isChargeClosed(c) ? closed : current).push(c);
  return { current, closed };
}

/** Reference of a charge: top-level `reference` or `period.reference`, as sent by the Master. */
export function chargeReference(c: Rec): string | undefined {
  const v = c.reference ?? (isRec(c.period) ? c.period.reference : undefined);
  return v === undefined || v === null || v === "" ? undefined : String(v);
}

/**
 * Keeps the last valid reply of one service when the new one is only a temporary
 * communication failure, so existing records never disappear from the screen.
 */
export function keepLastValid<T extends { state: string }>(prev: T | undefined, next: T | undefined): { reply: T | undefined; stale: boolean } {
  if (next?.state === "temporary_error" && prev?.state === "ok") return { reply: prev, stale: true };
  return { reply: next, stale: false };
}
