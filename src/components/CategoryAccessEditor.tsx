import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  stores: { id: string; name: string }[];
  selectedStoreIds: string[];
  storeCats: Record<string, string[]>;
  onStoreCatsChange: (v: Record<string, string[]>) => void;
  userCats: string[];
  onUserCatsChange: (v: string[]) => void;
}

function Grid({ cats, value, onChange }: { cats: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {cats.map((c) => (
        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={value.includes(c.id)}
            onCheckedChange={(ch) => onChange(ch ? [...value, c.id] : value.filter((x) => x !== c.id))}
          />
          {c.name}
        </label>
      ))}
    </div>
  );
}

export function CategoryAccessEditor({ stores, selectedStoreIds, storeCats, onStoreCatsChange, userCats, onUserCatsChange }: Props) {
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    supabase.from("categories").select("id, name").eq("active", true).then(({ data }) =>
      setCats(((data as any[]) || []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))),
    );
  }, []);

  return (
    <div className="border rounded-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <LayoutGrid className="w-4 h-4" />
        <Label className="text-sm font-semibold">Categorias</Label>
      </div>
      {selectedStoreIds.map((sid) => (
        <div key={sid} className="space-y-2">
          <p className="text-sm font-medium">Mostradas na {stores.find((s) => s.id === sid)?.name}</p>
          <Grid cats={cats} value={storeCats[sid] || []} onChange={(v) => onStoreCatsChange({ ...storeCats, [sid]: v })} />
        </div>
      ))}
      <div className="space-y-2">
        <p className="text-sm font-medium">Que este usuário pode ver</p>
        <Grid cats={cats} value={userCats} onChange={onUserCatsChange} />
      </div>
      <p className="text-xs text-muted-foreground">
        Nenhuma marcada = todas. As categorias da loja valem para todos os usuários dela.
      </p>
    </div>
  );
}
