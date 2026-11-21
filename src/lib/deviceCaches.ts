/**
 * Apaga o que o PDV guarda neste aparelho (cores, configurações, cardápio, carrinho).
 * Usado depois de "Apagar todo o sistema" para a tela voltar às cores padrão.
 */
export function clearDeviceCaches() {
  try {
    const fixed = ["pdv_theme_colors", "pdv_catalog_cache", "pdv_cart", "selectedSellerId", "pdv.activeStoreId"];
    for (const k of fixed) localStorage.removeItem(k);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("pdv.settingsFallback.")) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
  const root = document.documentElement;
  for (const v of ["--primary", "--ring", "--primary-light", "--primary-dark", "--primary-foreground", "--gradient-primary",
    "--secondary", "--secondary-foreground", "--accent", "--accent-foreground", "--checkout", "--background", "--foreground"]) {
    root.style.removeProperty(v);
  }
}
