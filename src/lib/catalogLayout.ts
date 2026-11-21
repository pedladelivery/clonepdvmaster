export type CatalogColumns = 2 | 3 | 4;

export function normalizeCatalogColumns(value: unknown): CatalogColumns {
  return value === 3 || value === 4 ? value : 2;
}

export const catalogColumnClasses: Record<CatalogColumns, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};