import type { MasterReply } from "../_shared/master.ts";

/**
 * How a Master reply is shown. Only the documented `endpoint_not_found` code means
 * "not published": any other 404 (no subscription, unknown charge) is a real answer.
 */
export type ServiceState =
  | "ok"
  | "not_published"
  | "not_found"
  | "auth_failed"
  | "unauthorized_installation"
  | "temporary_error"
  | "error";

export function masterCode(res: MasterReply): string | null {
  const d = res.data as Record<string, unknown> | null;
  const c = d?.code ?? d?.error;
  return typeof c === "string" ? c : null;
}

export function classify(res: MasterReply): ServiceState {
  if (res.ok) return "ok";
  const code = masterCode(res);
  if (code === "endpoint_not_found") return "not_published";
  if (res.status === 0 || res.status === 408 || res.status === 429 || res.status >= 500) return "temporary_error";
  if (res.status === 401) return "auth_failed";
  if (res.status === 403) return "unauthorized_installation";
  if (res.status === 404) return "not_found";
  return "error";
}

/**
 * Per-service pause after the Master answers `endpoint_not_found`, so an unpublished
 * service is not asked again on every refresh. Each service has its own entry: one
 * failing service never pauses the others. Kept in the function's memory.
 */
export const UNPUBLISHED_PAUSE_MS = 30 * 60_000;
const pausedUntil = new Map<string, number>();

export function isPaused(key: string, now = Date.now()): boolean {
  const until = pausedUntil.get(key);
  if (until === undefined) return false;
  if (until <= now) { pausedUntil.delete(key); return false; }
  return true;
}

export function recordOutcome(key: string, res: MasterReply, now = Date.now()) {
  if (classify(res) === "not_published") pausedUntil.set(key, now + UNPUBLISHED_PAUSE_MS);
  else pausedUntil.delete(key);
}

export function resetPauses() { pausedUntil.clear(); }

export const pausedReply = (): MasterReply => ({
  ok: false, status: 404, data: { code: "endpoint_not_found" },
  message: "Serviço ainda não publicado no Painel Master.",
});

/** Only ids the Master could have issued: letters, digits, dash, underscore. */
export const CHARGE_ID = /^[A-Za-z0-9_-]{1,100}$/;

const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Returns the installation / product a financial reply says it belongs to, when it says so.
 * Looks at the top level and at a single wrapped object, never deeper.
 */
export function replyOwner(data: unknown): { installation: string | null; product: string | null } {
  const root = rec(data) ?? {};
  const inner = rec(root.data) ?? rec(root.charge) ?? rec(root.subscription) ?? {};
  const pick = (k: string[]) => {
    for (const src of [root, inner]) for (const key of k) { const v = str(src[key]); if (v) return v.toLowerCase(); }
    return null;
  };
  return { installation: pick(["installation_id"]), product: pick(["product", "product_type"]) };
}

/** True when the reply names another installation or another product. */
export function foreignReply(data: unknown, installationId: string): string | null {
  const o = replyOwner(data);
  if (o.installation && o.installation !== installationId.toLowerCase()) return "outra instalação";
  if (o.product && o.product !== "pdv_salao") return `outro produto (${o.product})`;
  return null;
}

/** Pagination the Master documents on /charges and /payments (`page`, `per_page`). */
export function pageQuery(page: unknown): string {
  const n = Number(page);
  return Number.isInteger(n) && n > 1 && n <= 1000 ? `?page=${n}` : "";
}

/**
 * The checkout link the Master returns. The charge contract names it `checkout_url`;
 * it is accepted at the top level or inside `charge` / `checkout`, and only as https.
 */
export function checkoutUrl(data: unknown): string | null {
  const root = rec(data) ?? {};
  for (const src of [root, rec(root.charge) ?? {}, rec(root.checkout) ?? {}]) {
    const v = str(src.checkout_url);
    if (v && /^https:\/\/[^\s]+$/i.test(v)) return v;
  }
  return null;
}
