import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { callMaster } from "@/lib/masterApi";

interface MasterEvent {
  id: string;
  kind: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const KINDS: Record<string, string> = {
  connection: "Conexão",
  failure: "Falha de comunicação",
  command_received: "Comando recebido",
  command_executed: "Comando executado",
  control_change: "Alteração de controle",
  sync: "Sincronização",
  config: "Configuração",
  auth_login: "Login",
  auth_failure: "Login inválido",
  auth_lock: "Login bloqueado",
  auth_password: "Troca de senha",
  auth_sessions: "Sessões encerradas",
};

const PAGE = 50;

export const HistoryTab = () => {
  const [kind, setKind] = useState("all");
  const [events, setEvents] = useState<MasterEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (before?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await callMaster<{ events: MasterEvent[] }>("master-admin", {
        action: "events",
        limit: PAGE,
        ...(kind !== "all" ? { kind } : {}),
        ...(before ? { before } : {}),
      });
      setEvents((prev) => (before ? [...prev, ...res.events] : res.events));
      setHasMore(res.events.length === PAGE);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os registros</SelectItem>
            {Object.entries(KINDS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => load()} disabled={loading}>Atualizar</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Data</TableHead>
              <TableHead className="w-48">Tipo</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 && !loading && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
            )}
            {events.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(ev.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell><Badge variant={ev.kind === "failure" || ev.kind === "auth_lock" ? "destructive" : "secondary"}>{KINDS[ev.kind] ?? ev.kind}</Badge></TableCell>
                <TableCell className="text-sm">{ev.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hasMore && (
        <Button variant="outline" disabled={loading} onClick={() => load(events[events.length - 1]?.created_at)}>
          Carregar mais
        </Button>
      )}
    </div>
  );
};
