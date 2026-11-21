import { supabase } from "@/lib/dbClient";

/**
 * Upsert que ignora colunas que não existem no banco atual
 * (ex.: backup gerado numa versão diferente do sistema).
 */
const STORE_TABLES = new Set(["sales", "stock_movements", "transactions"]);
let cachedStore: string | null = null;

async function fallbackStoreId(): Promise<string | null> {
  const saved = localStorage.getItem("pdv.activeStoreId");
  if (saved && saved !== "all") return saved;
  if (cachedStore) return cachedStore;
  const { data } = await (supabase as any)
    .from("stores").select("id").order("created_at").limit(1).maybeSingle();
  cachedStore = data?.id ?? null;
  return cachedStore;
}

export async function safeUpsert(table: string, rows: any[]) {
  let data = rows;
  if (STORE_TABLES.has(table) && data.some((r) => !r?.store_id)) {
    const sid = await fallbackStoreId();
    if (!sid) throw new Error("Cadastre ou selecione uma loja antes de restaurar");
    data = data.map((r) => (r?.store_id ? r : { ...r, store_id: sid }));
  }
  const removed = new Set<string>();
  for (let attempt = 0; attempt < 30; attempt++) {
    const { error } = await (supabase as any).from(table).upsert(data, { onConflict: "id" });
    if (!error) return;
    const m = /Could not find the '([^']+)' column/i.exec(error.message ?? "");
    if (!m || removed.has(m[1])) throw error;
    const col = m[1];
    removed.add(col);
    data = data.map((r) => {
      const { [col]: _omit, ...rest } = r ?? {};
      return rest;
    });
  }
  throw new Error(`${table}: muitas colunas incompatíveis no backup`);
}
