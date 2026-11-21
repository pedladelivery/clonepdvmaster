export type AreaKey =
  | "catalog"
  | "customers"
  | "suppliers"
  | "sellers"
  | "pending-sales"
  | "sales"
  | "returns"
  | "stock"
  | "financial"
  | "reports"
  | "settings"
  | "subscription";

export type PermissionsMap = Partial<Record<AreaKey, boolean>>;

export const AREA_LABELS: Record<AreaKey, string> = {
  catalog: "Catálogo",
  customers: "Clientes",
  suppliers: "Fornecedores",
  sellers: "Vendedores",
  "pending-sales": "Vendas em Aberto",
  sales: "Vendas / Histórico",
  returns: "Devoluções",
  stock: "Estoque",
  financial: "Financeiro",
  reports: "Relatórios",
  settings: "Configurações (inclui Administradores)",
  subscription: "Minha Assinatura (dados financeiros)",
};

export const ALL_AREAS: AreaKey[] = Object.keys(AREA_LABELS) as AreaKey[];

export const DEFAULT_OPERATOR_PERMISSIONS: PermissionsMap = {
  sales: true,
  "pending-sales": true,
};

// Normalize the DB permission keys (which may use either snake_case or kebab-case)
export function normalizePermissions(raw: unknown): PermissionsMap {
  if (!raw || typeof raw !== "object") return {};
  const out: PermissionsMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k.replace(/_/g, "-") as AreaKey;
    if ((ALL_AREAS as string[]).includes(key)) {
      out[key] = Boolean(v);
    }
  }
  return out;
}

export function canAccess(
  role: string | null | undefined,
  permissions: PermissionsMap,
  area: AreaKey,
): boolean {
  if (role === "admin") return true;
  // Settings is admin-only (contains admin management)
  if (area === "settings") return false;
  return Boolean(permissions[area]);
}
