import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { blockedMessage, type PdvControl, type PdvControlKey } from "@/lib/pdvControls";

interface PdvControlsContextType {
  controls: Partial<Record<PdvControlKey, PdvControl>>;
  loading: boolean;
  isBlocked: (key: PdvControlKey) => boolean;
  messageFor: (key: PdvControlKey) => string;
  refresh: () => Promise<void>;
}

const PdvControlsContext = createContext<PdvControlsContextType | undefined>(undefined);

export const PdvControlsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [controls, setControls] = useState<Partial<Record<PdvControlKey, PdvControl>>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setControls({});
      setLoading(false);
      return;
    }
    const { data, error } = await (supabase as any).from("pdv_controls").select("*");
    // On failure keep the last known state so the PDV keeps working.
    if (!error && Array.isArray(data)) {
      const next: Partial<Record<PdvControlKey, PdvControl>> = {};
      for (const row of data as PdvControl[]) next[row.key] = row;
      setControls(next);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
    if (!user) return;
    const channel = supabase
      .channel(`pdv-controls-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pdv_controls" }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const isBlocked = useCallback((key: PdvControlKey) => Boolean(controls[key]?.blocked), [controls]);
  const messageFor = useCallback(
    (key: PdvControlKey) => blockedMessage(key, controls[key]?.message),
    [controls],
  );

  return (
    <PdvControlsContext.Provider value={{ controls, loading, isBlocked, messageFor, refresh }}>
      {children}
    </PdvControlsContext.Provider>
  );
};

export const usePdvControls = () => {
  const ctx = useContext(PdvControlsContext);
  if (!ctx) throw new Error("usePdvControls must be used within PdvControlsProvider");
  return ctx;
};
