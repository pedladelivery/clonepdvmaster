import { supabase } from "@/lib/dbClient";
import { safeUpsert } from "./safeUpsert";

export type ModuleId = "cardapio" | "clientes" | "vendas";

export interface DataModule {
  id: ModuleId;
  label: string;
  description: string;
  /** tabelas na ordem de exportação/restauração (pais antes dos filhos) */
  tables: string[];
  /** ordem de exclusão (filhos antes dos pais) */
  deleteOrder: string[];
}

export const DATA_MODULES: DataModule[] = [
  {
    id: "cardapio",
    label: "Cardápio",
    description: "Categorias, produtos e complementos (grupos, itens e vínculos)",
    tables: ["categories", "products", "complement_groups", "complement_items", "product_complement_groups"],
    deleteOrder: ["product_complement_groups", "complement_items", "complement_groups", "products", "categories"],
  },
  {
    id: "clientes",
    label: "Clientes",
    description: "Cadastro de clientes",
    tables: ["customers"],
    deleteOrder: ["customers"],
  },
  {
    id: "vendas",
    label: "Vendas",
    description: "Vendas, itens, devoluções e movimentações de estoque",
    tables: ["sales", "sale_items", "returns", "stock_movements", "transactions"],
    deleteOrder: ["returns", "sale_items", "stock_movements", "transactions", "sales"],
  },
];

export interface ModuleBackupFile {
  app: "RestaurPOS";
  version: 1;
  module: ModuleId;
  exported_at: string;
  data: Record<string, any[]>;
}

async function fetchAll(table: string) {
  const rows: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table as any)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function exportModule(mod: DataModule): Promise<ModuleBackupFile> {
  const data: Record<string, any[]> = {};
  for (const table of mod.tables) {
    data[table] = await fetchAll(table);
  }
  return {
    app: "RestaurPOS",
    version: 1,
    module: mod.id,
    exported_at: new Date().toISOString(),
    data,
  };
}

export function downloadModuleBackup(backup: ModuleBackupFile) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup-${backup.module}-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseModuleBackup(text: string, mod: DataModule): ModuleBackupFile {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("Arquivo de backup inválido");
  }
  if (parsed.module && parsed.module !== mod.id) {
    throw new Error(
      `Este arquivo é um backup de "${parsed.module}" e não pode ser restaurado em "${mod.id}"`
    );
  }
  return parsed as ModuleBackupFile;
}

export async function importModule(
  mod: DataModule,
  backup: ModuleBackupFile
): Promise<number> {
  let total = 0;
  for (const table of mod.tables) {
    const rows = backup.data[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      try {
        await safeUpsert(table, chunk);
      } catch (e: any) {
        throw new Error(`${table}: ${e?.message ?? e}`);
      }
    }
    total += rows.length;
  }
  return total;
}

const db = supabase as any;

async function deleteAll(table: string) {
  const { error } = await db.from(table).delete().not("id", "is", null);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function selectColumn(table: string, column: string): Promise<string[]> {
  const rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db.from(table).select(column).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return Array.from(new Set(rows.map((r) => r[column]).filter((v) => v != null)));
}

async function inChunks(ids: string[], fn: (chunk: string[]) => Promise<void>) {
  for (let i = 0; i < ids.length; i += 150) await fn(ids.slice(i, i + 150));
}

export interface ClearResult {
  /** produtos que não puderam ser apagados por aparecerem em vendas e foram ocultados */
  hiddenProducts: number;
}

/**
 * Limpa o cardápio. Produtos usados em vendas antigas não podem ser apagados
 * (o histórico depende deles): esses ficam ocultos (active = false), assim como
 * as categorias que eles usam.
 */
async function clearCardapio(): Promise<ClearResult> {
  await deleteAll("product_complement_groups");
  await deleteAll("complement_items");
  await deleteAll("complement_groups");
  await deleteAll("store_products");
  await deleteAll("store_stock");

  const used = new Set([
    ...(await selectColumn("sale_items", "product_id")),
    ...(await selectColumn("stock_movements", "product_id")),
  ]);
  const allProducts: { id: string; category_id: string }[] = [];
  {
    let from = 0;
    while (true) {
      const { data, error } = await db.from("products").select("id, category_id").range(from, from + 999);
      if (error) throw new Error(`products: ${error.message}`);
      allProducts.push(...(data ?? []));
      if (!data || data.length < 1000) break;
      from += 1000;
    }
  }
  const toDelete = allProducts.filter((p) => !used.has(p.id)).map((p) => p.id);
  const toHide = allProducts.filter((p) => used.has(p.id));

  await inChunks(toDelete, async (chunk) => {
    const { error } = await db.from("products").delete().in("id", chunk);
    if (error) throw new Error(`products: ${error.message}`);
  });
  await inChunks(toHide.map((p) => p.id), async (chunk) => {
    const { error } = await db.from("products").update({ active: false }).in("id", chunk);
    if (error) throw new Error(`products: ${error.message}`);
  });

  // categorias: apaga as livres; oculta as que ainda têm produtos ocultos
  await deleteAll("store_categories");
  await deleteAll("user_categories");
  const keptCats = Array.from(new Set(toHide.map((p) => p.category_id).filter(Boolean)));
  const allCats = await selectColumn("categories", "id");
  const catsToDelete = allCats.filter((c) => !keptCats.includes(c));
  await inChunks(catsToDelete, async (chunk) => {
    const { error } = await db.from("categories").delete().in("id", chunk);
    if (error) throw new Error(`categories: ${error.message}`);
  });
  await inChunks(keptCats, async (chunk) => {
    const { error } = await db.from("categories").update({ active: false }).in("id", chunk);
    if (error) throw new Error(`categories: ${error.message}`);
  });

  return { hiddenProducts: toHide.length };
}

export async function clearModule(mod: DataModule): Promise<ClearResult> {
  if (mod.id === "cardapio") return clearCardapio();
  for (const table of mod.deleteOrder) await deleteAll(table);
  return { hiddenProducts: 0 };
}

/** Limpa tudo: vendas primeiro (liberam os produtos), depois clientes e cardápio. */
export async function clearAllModules(): Promise<ClearResult> {
  const order: ModuleId[] = ["vendas", "clientes", "cardapio"];
  let result: ClearResult = { hiddenProducts: 0 };
  for (const id of order) {
    const mod = DATA_MODULES.find((m) => m.id === id)!;
    result = await clearModule(mod);
  }
  return result;
}
