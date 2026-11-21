import { supabase } from "@/lib/dbClient";
import { safeUpsert } from "./safeUpsert";

export const BACKUP_TABLES = [
  "categories",
  "products",
  "complement_groups",
  "complement_items",
  "product_complement_groups",
  "customers",
  "sellers",
  "suppliers",
  "sales",
  "sale_items",
  "stock_movements",
  "transactions",
  "returns",
  "store_settings",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BackupFile {
  app: "RestaurPOS";
  version: 1;
  exported_at: string;
  data: Record<string, any[]>;
}

export async function exportBackup(): Promise<BackupFile> {
  const data: Record<string, any[]> = {};

  for (const table of BACKUP_TABLES) {
    const rows: any[] = [];
    let from = 0;
    const pageSize = 1000;

    // paginação para não perder registros acima do limite padrão
    while (true) {
      const { data: page, error } = await supabase
        .from(table as any)
        .select("*")
        .range(from, from + pageSize - 1);

      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(page ?? []));
      if (!page || page.length < pageSize) break;
      from += pageSize;
    }

    data[table] = rows;
  }

  return {
    app: "RestaurPOS",
    version: 1,
    exported_at: new Date().toISOString(),
    data,
  };
}

export function downloadBackup(backup: BackupFile) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup-restaurpos-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseBackupFile(text: string): BackupFile {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("Arquivo de backup inválido");
  }
  return parsed as BackupFile;
}

export interface ImportResult {
  table: string;
  count: number;
  error?: string;
}

export async function importBackup(backup: BackupFile): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (const table of BACKUP_TABLES) {
    const rows = backup.data[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    try {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        await safeUpsert(table, chunk);
      }
      results.push({ table, count: rows.length });
    } catch (e: any) {
      results.push({ table, count: 0, error: e?.message ?? "erro" });
    }
  }

  return results;
}
