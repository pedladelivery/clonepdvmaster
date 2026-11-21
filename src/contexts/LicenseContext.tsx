import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LicenseContextType {
  /** True while the Painel Master keeps the license suspended. */
  suspended: boolean;
  licenseStatus: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);
const POLL_MS = 30_000;

/**
 * Reads the license state stored in the database (never local state), listens for changes in
 * realtime and re-checks on focus and every 30 s, so suspension and reactivation apply in every
 * open tab without a new login or reload. The database enforces the same state on its own.
 */
export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [suspended, setSuspended] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSuspended(false);
      setLicenseStatus(null);
      setLoading(false);
      return;
    }
    const { data, error } = await (supabase as any)
      .from("pdv_license_state").select("license_status, suspended").eq("id", 1).maybeSingle();
    // On a read failure keep the last known state.
    if (!error) {
      setSuspended(Boolean(data?.suspended));
      setLicenseStatus(data?.license_status ?? null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    if (!user) return;
    const channel = supabase
      .channel(`pdv-license-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pdv_license_state" }, () => {
        void refresh();
      })
      .subscribe();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, refresh]);

  return (
    <LicenseContext.Provider value={{ suspended, licenseStatus, loading, refresh }}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicense = () => {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error("useLicense must be used within LicenseProvider");
  return ctx;
};
