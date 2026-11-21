import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "pdv_master_session";

export const masterSession = {
  get: () => sessionStorage.getItem(SESSION_KEY),
  set: (token: string) => sessionStorage.setItem(SESSION_KEY, token),
  clear: () => sessionStorage.removeItem(SESSION_KEY),
};

export class MasterApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function callMaster<T = any>(
  fn: "master-auth" | "master-admin",
  body: Record<string, unknown>,
): Promise<T> {
  const token = masterSession.get();
  const { data, error } = await supabase.functions.invoke(fn, {
    body,
    headers: token ? { "x-master-session": token } : {},
  });
  if (error) {
    let message = "Não foi possível falar com o servidor.";
    let status = 0;
    const ctx = (error as any).context as Response | undefined;
    if (ctx && typeof ctx.json === "function") {
      status = ctx.status;
      try {
        const payload = await ctx.json();
        if (payload?.error) message = payload.error;
      } catch {
        /* keep default */
      }
    }
    if (status === 401) masterSession.clear();
    throw new MasterApiError(message, status);
  }
  return data as T;
}
