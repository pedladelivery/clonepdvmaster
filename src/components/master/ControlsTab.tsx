import { Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PDV_CONTROL_LABELS, type PdvControl, type PdvControlKey } from "@/lib/pdvControls";

const ORDER: PdvControlKey[] = ["admin", "tables", "sales"];

export const ControlsTab = ({ controls }: { controls: PdvControl[] }) => {
  const byKey = new Map(controls.map((c) => [c.key, c]));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Estes controles são definidos pelo Painel Master. O PDV aplica os bloqueios na tela e no banco de dados.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {ORDER.map((key) => {
          const c = byKey.get(key);
          const blocked = Boolean(c?.blocked);
          return (
            <Card key={key}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{PDV_CONTROL_LABELS[key]}</CardTitle>
                  {blocked ? <Lock className="h-5 w-5 text-destructive" /> : <Unlock className="h-5 w-5 text-success" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Badge variant={blocked ? "destructive" : "secondary"}>{blocked ? "Bloqueado" : "Liberado"}</Badge>
                <p><span className="text-muted-foreground">Mensagem do Master:</span> {c?.message || "—"}</p>
                <p><span className="text-muted-foreground">Última alteração:</span> {c ? new Date(c.changed_at).toLocaleString("pt-BR") : "—"}</p>
                <p><span className="text-muted-foreground">Responsável:</span> {c?.changed_by || "—"}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
