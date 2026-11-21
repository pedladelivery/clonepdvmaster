import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthContext } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { setClientOverride } from "@/lib/dbClient";
import { callMaster } from "@/lib/masterApi";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/** Memory-only storage: the Master's PDV access disappears with the page and never replaces the PDV login. */
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: Session };

const Ctx = createContext<{ state: State; open: () => void }>({ state: { status: "idle" }, open: () => {} });

/** Opens PDV access for the Master area (as the PDV's first administrator) while /master is open. */
export const MasterPdvAccessProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<State>({ status: "idle" });
  const clientRef = useRef<SupabaseClient<Database> | null>(null);
  const busyRef = useRef(false);

  const open = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ status: "loading" });
    try {
      const tokens = await callMaster<{ access_token: string; refresh_token: string }>("master-admin", { action: "pdv_bridge" });
      const client = clientRef.current ?? createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
        auth: { storage: memoryStorage(), storageKey: "pdv-master-access", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      clientRef.current = client;
      const { data, error } = await client.auth.setSession(tokens);
      if (error || !data.session) throw error ?? new Error("Não foi possível abrir o acesso ao PDV.");
      setClientOverride(client);
      setState({ status: "ready", session: data.session });
    } catch (err) {
      setState({ status: "error", message: (err as Error).message });
    } finally {
      busyRef.current = false;
    }
  }, []);

  // Opened only when one of the PDV tabs is shown; closed when leaving /master.
  useEffect(() => {
    return () => {
      setClientOverride(null);
      void clientRef.current?.auth.signOut({ scope: "local" });
    };
  }, []);

  return <Ctx.Provider value={{ state, open: () => void open() }}>{children}</Ctx.Provider>;
};

/** Renders the copied PDV screens with the Master's PDV access. */
export const MasterPdvGate = ({ children }: { children: React.ReactNode }) => {
  const { state, open } = useContext(Ctx);
  useEffect(() => {
    if (state.status === "idle") open();
  }, [state.status, open]);
  if (state.status === "idle" || state.status === "loading") return <p className="text-sm text-muted-foreground">Carregando dados do PDV...</p>;
  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Não foi possível abrir os dados do PDV</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={open}><RefreshCw className="h-4 w-4 mr-2" />Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }
  const noop = async () => ({ error: null });
  return (
    <AuthContext.Provider value={{ user: state.session.user, session: state.session, loading: false, signIn: noop, signOut: async () => {} }}>
      <StoreProvider scopeStorageKey="pdv.master.activeStoreId">{children}</StoreProvider>
    </AuthContext.Provider>
  );
};
