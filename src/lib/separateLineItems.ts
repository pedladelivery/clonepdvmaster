type QuantityItem = {
  id?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  price?: number;
  total?: number;
};

/** Expande quantidades agrupadas para que cada unidade tenha sua própria linha. */
export function separateLineItems<T extends QuantityItem>(items: T[]): T[] {
  return items.flatMap((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));

    return Array.from({ length: quantity }, (_, index) => ({
      ...item,
      id: item.id && quantity > 1 ? `${item.id}__unit-${index + 1}` : item.id,
      quantity: 1,
      ...(item.unit_price !== undefined ? { total_price: Number(item.unit_price) } : {}),
      ...(item.price !== undefined ? { total: Number(item.price) } : {}),
    })) as T[];
  });
}