import type { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { catalogColumnClasses, normalizeCatalogColumns } from '@/lib/catalogLayout';

export function CatalogGrid({ kind, children }: { kind: 'category' | 'product'; children: ReactNode }) {
  const { settings } = useTheme();
  const columns = normalizeCatalogColumns(kind === 'category' ? settings.category_columns : settings.product_columns);
  return <div className={`grid ${catalogColumnClasses[columns]} gap-2 sm:gap-4 w-full`} data-catalog-grid={kind}>{children}</div>;
}