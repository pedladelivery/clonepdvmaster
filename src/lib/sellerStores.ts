import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export async function fetchSellerStoreMap(): Promise<Record<string, string[]>> {
  const { data } = await db.from("seller_stores").select("seller_id, store_id");
  const map: Record<string, string[]> = {};
  for (const r of (data ?? []) as { seller_id: string; store_id: string }[]) {
    (map[r.seller_id] ??= []).push(r.store_id);
  }
  return map;
}

export async function saveSellerStores(sellerId: string, storeIds: string[]) {
  const { error: delErr } = await db.from("seller_stores").delete().eq("seller_id", sellerId);
  if (delErr) throw delErr;
  if (storeIds.length) {
    const { error } = await db
      .from("seller_stores")
      .insert(storeIds.map((store_id) => ({ seller_id: sellerId, store_id })));
    if (error) throw error;
  }
}

export async function fetchSellerIdsForStore(storeId: string): Promise<string[]> {
  const { data } = await db.from("seller_stores").select("seller_id").eq("store_id", storeId);
  return ((data ?? []) as { seller_id: string }[]).map((r) => r.seller_id);
}
