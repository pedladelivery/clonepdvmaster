import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePdvControls } from "@/contexts/PdvControlsContext";
import { ADMIN_LOCKED_AREAS } from "@/lib/pdvControls";
import {
  AreaKey,
  PermissionsMap,
  canAccess,
  normalizePermissions,
} from "@/lib/permissions";

interface State {
  role: string | null;
  permissions: PermissionsMap;
  loading: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({
    role: null,
    permissions: {},
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setState({ role: null, permissions: {}, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role, permissions")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setState({
        role: (data?.role as string) ?? "operator",
        permissions: normalizePermissions((data as any)?.permissions),
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isAdmin = state.role === "admin";
  const { isBlocked } = usePdvControls();
  const adminLocked = isBlocked("admin");
  const can = (area: AreaKey) => {
    if (adminLocked && (ADMIN_LOCKED_AREAS as readonly string[]).includes(area)) return false;
    return canAccess(state.role, state.permissions, area);
  };

  return { ...state, isAdmin, can, adminLocked };
}
