/**
 * Opens the Master's checkout link in the tab prepared during the click.
 *
 * The tab is opened synchronously in the click (so popup blockers allow it) and only
 * navigated once the link arrives. Its `opener` must be cut AFTER the navigation is
 * started: inside an embedded/sandboxed page, a window that already lost its opener
 * can no longer be navigated and stays blank (SecurityError).
 * Returns false when the tab could not be navigated, so the caller shows a link instead.
 */
export function openPreparedTab(win: Window | null, url: string): boolean {
  if (!win || win.closed) return false;
  try {
    win.location.href = url;
  } catch {
    try { win.close(); } catch { /* ignore */ }
    return false;
  }
  try { win.opener = null; } catch { /* already navigating away — fine */ }
  return true;
}

export function prepareTab(message = "Abrindo o checkout seguro do Mercado Pago…"): Window | null {
  try {
    const win = window.open("about:blank", "_blank");
    if (win) {
      try {
        win.document.title = message;
        const p = win.document.createElement("p");
        p.style.cssText = "font-family:system-ui,sans-serif;padding:24px";
        p.textContent = message;
        win.document.body.appendChild(p);
      } catch { /* ignore */ }
    }
    return win;
  } catch {
    return null;
  }
}

/** Only official Mercado Pago checkout hosts over https are ever opened. */
const MP_HOST = /^(www\.)?mercadopago\.com(\.[a-z]{2})?$|^([a-z0-9-]+\.)*mercadopago\.com(\.[a-z]{2})?$|^(www\.)?mercadolivre\.com(\.[a-z]{2})?$|^mpago\.(la|li)$/i;
export function isOfficialCheckout(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && MP_HOST.test(u.hostname);
  } catch { return false; }
}
