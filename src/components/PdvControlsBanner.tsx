import { ShieldAlert } from "lucide-react";
import { usePdvControls } from "@/contexts/PdvControlsContext";
import type { PdvControlKey } from "@/lib/pdvControls";

const KEYS: PdvControlKey[] = ["sales", "tables", "admin"];

export const PdvControlsBanner = () => {
  const { isBlocked, messageFor } = usePdvControls();
  const active = KEYS.filter((k) => isBlocked(k));
  if (active.length === 0) return null;
  return (
    <div role="alert" className="bg-destructive/10 border-b border-destructive/30 px-3 sm:px-6 py-2 space-y-1">
      {active.map((key) => (
        <p key={key} className="flex items-start gap-2 text-xs sm:text-sm text-destructive font-medium">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{messageFor(key)}</span>
        </p>
      ))}
    </div>
  );
};
