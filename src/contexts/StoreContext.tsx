import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/dbClient";
import { useAuth } from "@/contexts/AuthContext";

export interface Store {
  id: string;
  name: string;
  code: string | null;
  slug: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;
}

export type StoreRole = "admin" | "manager" | "cashier" | "operator";

interface StoreContextValue {
  stores: Store[];
  loading: boolean;
  isSuperAdmin: boolean;
  role: StoreRole | null;
  /** Loja usada para filtrar consultas. null = todas as lojas (apenas super admin). */
  scopeStoreId: string | null;
  /** Loja usada ao gravar novos registros. Nunca é escolhida manualmente numa venda. */
  writeStoreId: string | null;
  activeStore: Store | null;
  /** Lojas que o usuário pode escolher. */
  allowedStores: Store[];
  setScopeStoreId: (id: string | null) => void;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const SCOPE_KEY = "pdv.activeStoreId";

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
};

export const StoreProvider: React.FC<{ children: React.ReactNode; scopeStorageKey?: string }> = ({
  children,
  scopeStorageKey = SCOPE_KEY,
}) => {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [role, setRole] = useState<StoreRole | null>(null);
  const [profileStoreId, setProfileStoreId] = useState<string | null>(null);
  const [linkedStoreIds, setLinkedStoreIds] = useState<string[]>([]);
  const [scope, setScope] = useState<string | null>(() => {
    const saved = localStorage.getItem(scopeStorageKey);
    return saved && saved !== "all" ? saved : null;
  });
  const [loading, setLoading] = useState(true);

  const refreshStores = useCallback(async () => {
    const { data } = await supabase
      .from("stores")
      .select("id, name, code, slug, address, phone, active")
      .order("code", { ascending: true });
    setStores((data as Store[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) {
          setRole(null);
          setProfileStoreId(null);
          setStores([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const [{ data: profile }, { data: links }] = await Promise.all([
        supabase.from("profiles").select("role, store_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_stores").select("store_id").eq("user_id", user.id),
        refreshStores(),
      ]);
      if (cancelled) return;
      setLinkedStoreIds(((links as any[]) ?? []).map((l) => l.store_id));
      setRole(((profile?.role as StoreRole) ?? "operator") as StoreRole);
      setProfileStoreId((profile as any)?.store_id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshStores]);

  const isSuperAdmin = role === "admin";

  const allowedStores = useMemo(() => {
    if (isSuperAdmin) return stores;
    const ids = new Set(linkedStoreIds);
    if (profileStoreId) ids.add(profileStoreId);
    return stores.filter((s) => ids.has(s.id));
  }, [isSuperAdmin, stores, linkedStoreIds, profileStoreId]);

  const userStoreId = useMemo(() => {
    if (scope && allowedStores.some((s) => s.id === scope)) return scope;
    if (profileStoreId && allowedStores.some((s) => s.id === profileStoreId)) return profileStoreId;
    return allowedStores[0]?.id ?? null;
  }, [scope, allowedStores, profileStoreId]);

  // Ignora loja salva que não existe mais (ex.: loja apagada).
  const validScope = scope && stores.some((s) => s.id === scope) ? scope : null;
  const scopeStoreId = isSuperAdmin ? validScope : userStoreId;

  const writeStoreId = useMemo(() => {
    if (!isSuperAdmin) return userStoreId;
    if (validScope) return validScope;
    return stores.find((s) => s.active)?.id ?? stores[0]?.id ?? null;
  }, [isSuperAdmin, userStoreId, validScope, stores]);

  const activeStore = useMemo(
    () => stores.find((s) => s.id === (scopeStoreId ?? writeStoreId)) ?? null,
    [stores, scopeStoreId, writeStoreId],
  );

  const setScopeStoreId = useCallback((id: string | null) => {
    setScope(id);
    localStorage.setItem(scopeStorageKey, id ?? "all");
  }, [scopeStorageKey]);

  return (
    <StoreContext.Provider
      value={{
        stores,
        loading,
        isSuperAdmin,
        role,
        scopeStoreId,
        writeStoreId,
        activeStore,
        allowedStores,
        setScopeStoreId,
        refreshStores,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

/** Aplica o filtro de loja a uma query do Supabase (null = todas, só super admin). */
export function applyStoreFilter<T>(query: T, storeId: string | null): T {
  if (!storeId) return query;
  return (query as any).eq("store_id", storeId) as T;
}
