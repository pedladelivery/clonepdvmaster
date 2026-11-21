import { supabase } from "@/integrations/supabase/client";

/**
 * Ajusta o saldo de estoque de um produto em UMA loja específica.
 * O produto continua global; apenas o saldo é individual por loja.
 */
export async function adjustStoreStock(storeId: string, productId: string, delta: number) {
  const { data: existing, error: readError } = await supabase
    .from("store_stock")
    .select("id, stock_quantity")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .maybeSingle();
  if (readError) throw readError;

  const current = Number(existing?.stock_quantity ?? 0);
  const next = Math.max(0, current + delta);

  if (existing) {
    const { error } = await supabase
      .from("store_stock")
      .update({ stock_quantity: next })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("store_stock")
      .insert({ store_id: storeId, product_id: productId, stock_quantity: next });
    if (error) throw error;
  }

  return next;
}
