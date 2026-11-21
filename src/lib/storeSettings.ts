import { supabase } from "@/lib/dbClient";

/** Busca a configuração da loja; se ela não tiver uma própria, usa a geral (store_id nulo). */
export async function fetchStoreSettingsRow(storeId: string | null, columns = "*") {
  if (storeId) {
    const { data } = await (supabase as any)
      .from("store_settings").select(columns).eq("store_id", storeId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return { data, isGlobal: false };
  }
  const { data, error } = await (supabase as any)
    .from("store_settings").select(columns).is("store_id", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return { data, isGlobal: true };
}

/** Colunas novas que podem ainda não existir em bancos antigos: guardadas também no aparelho. */
const LOCAL_FALLBACK_COLUMNS = ["cart_icon_size", "save_icon_size", "gradient_enabled", "gradient_color", "gradient_direction", "product_label_align"] as const;
const localKey = (storeId: string | null) => `pdv.settingsFallback.${storeId ?? "global"}`;

export function readLocalSettingsFallback(storeId: string | null): Record<string, any> {
  try {
    const own = JSON.parse(localStorage.getItem(localKey(storeId)) || "null");
    if (own) return own;
    return JSON.parse(localStorage.getItem(localKey(null)) || "{}") || {};
  } catch {
    return {};
  }
}

/** Preenche colunas ausentes no banco com o valor salvo no aparelho. */
export function withLocalFallback<T extends Record<string, any>>(data: T | null, storeId: string | null): T | null {
  if (!data) return data;
  const local = readLocalSettingsFallback(storeId);
  const out: any = { ...data };
  for (const col of LOCAL_FALLBACK_COLUMNS) {
    if (out[col] === undefined && local[col] !== undefined) out[col] = local[col];
  }
  return out;
}

/**
 * Salva store_settings ignorando colunas que o banco ainda não tem.
 * As colunas de ícone ignoradas ficam guardadas no aparelho.
 */
export async function saveStoreSettingsRow(existingId: string | null, payload: Record<string, any>) {
  const storeId = payload.store_id ?? null;
  const local: Record<string, any> = {};
  for (const col of LOCAL_FALLBACK_COLUMNS) if (payload[col] !== undefined) local[col] = payload[col];
  localStorage.setItem(localKey(storeId), JSON.stringify(local));

  let data = { ...payload };
  const removed = new Set<string>();
  for (let attempt = 0; attempt < 20; attempt++) {
    const { error } = existingId
      ? await (supabase as any).from("store_settings").update(data).eq("id", existingId)
      : await (supabase as any).from("store_settings").insert([data]);
    if (!error) return { skipped: [...removed] };
    const m = /Could not find the '([^']+)' column/i.exec(error.message ?? "")
      || /column [\w.]*?\.?([a-z_]+) does not exist/i.exec(error.message ?? "");
    if (!m || removed.has(m[1])) throw error;
    removed.add(m[1]);
    delete data[m[1]];
  }
  throw new Error("Muitas colunas incompatíveis em store_settings");
}
