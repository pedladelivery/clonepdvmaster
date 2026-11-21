import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store as StoreIcon } from "lucide-react";
import { useStore } from "@/contexts/StoreContext";

/**
 * Seletor de loja. Aparece apenas para o super administrador —
 * demais usuários ficam travados na loja deles.
 */
export const StoreFilterSelect = ({ className }: { className?: string }) => {
  const { isSuperAdmin, stores, scopeStoreId, setScopeStoreId } = useStore();

  if (!isSuperAdmin) return null;

  return (
    <div className={className}>
      <Select
        value={scopeStoreId ?? "all"}
        onValueChange={(v) => setScopeStoreId(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[200px]">
          <StoreIcon className="h-4 w-4 mr-2 opacity-70" />
          <SelectValue placeholder="Loja" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as lojas</SelectItem>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
              {s.active ? "" : " (inativa)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
