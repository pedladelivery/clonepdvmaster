import { supabase } from "@/lib/dbClient";

const db = supabase as any;

/** store_id -> category ids (empty/missing = all categories) */
export async function fetchStoreCategoryMap(): Promise<Record<string, string[]>> {
  const { data } = await db.from("store_categories").select("store_id, category_id");
  const map: Record<string, string[]> = {};
  for (const r of data || []) (map[r.store_id] ||= []).push(r.category_id);
  return map;
}

export async function fetchUserCategories(userId: string): Promise<string[]> {
  const { data } = await db.from("user_categories").select("category_id").eq("user_id", userId);
  return (data || []).map((r: any) => r.category_id);
}

export async function saveStoreCategories(storeId: string, ids: string[]) {
  const { error } = await db.from("store_categories").delete().eq("store_id", storeId);
  if (error) throw error;
  if (ids.length) {
    const { error: e } = await db
      .from("store_categories")
      .insert(ids.map((category_id) => ({ store_id: storeId, category_id })));
    if (e) throw e;
  }
}

export async function saveUserCategories(userId: string, ids: string[]) {
  const { error } = await db.from("user_categories").delete().eq("user_id", userId);
  if (error) throw error;
  if (ids.length) {
    const { error: e } = await db
      .from("user_categories")
      .insert(ids.map((category_id) => ({ user_id: userId, category_id })));
    if (e) throw e;
  }
}

/** Returns allowed category ids for the PDV, or null = no restriction. */
export async function fetchAllowedCategoryIds(
  userId: string,
  storeId: string | null,
): Promise<Set<string> | null> {
  const [userIds, storeMap] = await Promise.all([
    fetchUserCategories(userId),
    storeId ? fetchStoreCategoryMap() : Promise.resolve({} as Record<string, string[]>),
  ]);
  const storeIds = storeId ? storeMap[storeId] || [] : [];
  let allowed: Set<string> | null = storeIds.length ? new Set(storeIds) : null;
  if (userIds.length) {
    allowed = allowed ? new Set(userIds.filter((id) => allowed!.has(id))) : new Set(userIds);
  }
  return allowed;
}
