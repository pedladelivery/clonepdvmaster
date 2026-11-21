import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase as pdvClient } from "@/integrations/supabase/client";

/**
 * Same client as the PDV, except while the Master area has opened its own PDV access
 * (see MasterPdvAccess): then these screens use that separate, memory-only login.
 * The PDV's own login in this browser is never touched.
 */
let override: SupabaseClient<Database> | null = null;

export function setClientOverride(client: SupabaseClient<Database> | null) {
  override = client;
}

export const supabase = new Proxy(pdvClient, {
  get(_target, prop) {
    const client = override ?? pdvClient;
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as typeof pdvClient;
