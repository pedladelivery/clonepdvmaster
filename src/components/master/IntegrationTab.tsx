import { useEffect, useState } from "react";
import { Clock, Eraser, Link2, PlugZap, RefreshCw, Save, Unplug, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { callMaster } from "@/lib/masterApi";
import { InstallationManager } from "./InstallationManager";

export interface Integration {
  base_url: string | null;
  installation_id: string | null;
  store_name: string | null;
  status: string;
  license_status: string | null;
  last_verify_at: string | null;
  last_heartbeat_at: string | null;
  last_sync_at: string | null;
  last_commands_at?: string | null;
  last_report_at?: string | null;
  last_sync_error_at?: string | null;
  last_error: string | null;
  sync_interval_seconds?: number | null;
  log_retention_days?: number | null;
  cleanup_last_at?: string | null;
  has_token: boolean;
  token_masked: string | null;
}

interface SyncStep { ok: boolean; http_status: number; message: string | null }
interface SyncSummary {
  heartbeat?: SyncStep;
  commands?: SyncStep & { received: number; processed: number; ignored: number };
  report?: SyncStep | null;
  errors: string[];
}

const STATUS_LABEL: Record<string, string> = {
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Falha de comunicação",
};

const INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30, 60];
const RETENTION_OPTIONS = [3, 7, 15, 30];
const intervalLabel = (m: number) => (m === 60 ? "1 hora" : m === 1 ? "1 minuto" : `${m} minutos`);
const perDay = (m: number) => Math.round(1440 / m);

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

interface Props {
  integration: Integration | null;
  contractReady: boolean;
  onChanged: () => void;
}

export const IntegrationTab = ({ integration, contractReady, onChanged }: Props) => {
  const { toast } = useToast();
  const [baseUrl, setBaseUrl] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [token, setToken] = useState("");
  const [storeName, setStoreName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [intervalMin, setIntervalMin] = useState("1");
  const [retentionDays, setRetentionDays] = useState("7");
  const [lastReply, setLastReply] = useState<{ ok: boolean; http_status: number; message: string | null; response: unknown } | null>(null);

  const verify = async (key: "test" | "reconnect") => {
    setBusy(key);
    try {
      const res = await callMaster<{ ok: boolean; http_status: number; message: string | null; response: unknown }>(
        "master-admin", { action: key === "test" ? "test_connection" : "reconnect" },
      );
      setLastReply(res);
      toast(res.ok
        ? { title: "Instalação validada pelo Painel Master" }
        : { title: "O Painel Master recusou a validação", description: res.message ?? `HTTP ${res.http_status}`, variant: "destructive" });
      onChanged();
    } catch (err) {
      toast({ title: "Não foi possível concluir", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    setBaseUrl(integration?.base_url ?? "");
    setInstallationId(integration?.installation_id ?? "");
    setStoreName(integration?.store_name ?? "");
    setToken("");
    const m = Math.round((integration?.sync_interval_seconds ?? 60) / 60);
    setIntervalMin(String(INTERVAL_OPTIONS.includes(m) ? m : 1));
    const r = integration?.log_retention_days ?? 7;
    setRetentionDays(String(RETENTION_OPTIONS.includes(r) ? r : 7));
  }, [integration]);

  const run = async (key: string, body: Record<string, unknown>, success: string) => {
    setBusy(key);
    try {
      await callMaster("master-admin", body);
      toast({ title: success });
      setToken("");
      onChanged();
    } catch (err) {
      toast({ title: "Não foi possível concluir", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy("sync");
    try {
      const res = await callMaster<{ ok: boolean; summary: SyncSummary }>("master-admin", { action: "sync_now" });
      const s = res.summary;
      const parts = [
        `Heartbeat: ${s.heartbeat?.ok ? "ok" : "falhou"}`,
        `Comandos: ${s.commands?.ok ? `${s.commands.received} recebido(s), ${s.commands.processed} processado(s)` : "falhou"}`,
        s.report ? `Relatório: ${s.report.ok ? "enviado" : "falhou"}` : null,
      ].filter(Boolean).join(" · ");
      toast(res.ok
        ? { title: "Sincronização concluída", description: parts }
        : { title: "Sincronização com falhas", description: `${parts}\n${s.errors.join(" | ")}`, variant: "destructive" });
      onChanged();
    } catch (err) {
      toast({ title: "Não foi possível sincronizar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const saveSyncSettings = () => void run(
    "sync-settings",
    { action: "save_sync_settings", interval_minutes: Number(intervalMin), retention_days: Number(retentionDays) },
    "Configuração de sincronização salva",
  );

  const cleanupNow = async () => {
    setBusy("cleanup");
    try {
      const res = await callMaster<{ result: { cron_runs_deleted: number; heartbeats_deleted: number } }>(
        "master-admin", { action: "cleanup_now" },
      );
      toast({
        title: "Limpeza concluída",
        description: `${res.result.cron_runs_deleted + res.result.heartbeats_deleted} registro(s) antigo(s) apagado(s).`,
      });
      onChanged();
    } catch (err) {
      toast({ title: "Não foi possível limpar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const currentMin = Math.round((integration?.sync_interval_seconds ?? 60) / 60);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      "save",
      { action: "save_config", base_url: baseUrl, installation_id: installationId, token, store_name: storeName },
      "Configuração salva",
    );
  };

  const status = integration?.status ?? "disconnected";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Situação da conexão</CardTitle>
            <Badge variant={status === "connected" ? "default" : status === "error" ? "destructive" : "secondary"}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">Licença:</span> {integration?.license_status === "active" ? "Ativa" : integration?.license_status === "suspended" ? "Suspensa" : integration?.license_status ?? "—"}</p>
          <p><span className="text-muted-foreground">Última validação:</span> {fmt(integration?.last_verify_at ?? null)}</p>
          <p><span className="text-muted-foreground">Último heartbeat:</span> {fmt(integration?.last_heartbeat_at ?? null)}</p>
          <p><span className="text-muted-foreground">Última sincronização:</span> {fmt(integration?.last_sync_at ?? null)}</p>
          <p><span className="text-muted-foreground">Última consulta de comandos:</span> {fmt(integration?.last_commands_at ?? null)}</p>
          <p><span className="text-muted-foreground">Último relatório enviado:</span> {fmt(integration?.last_report_at ?? null)}</p>
          <p><span className="text-muted-foreground">Última falha:</span> {fmt(integration?.last_sync_error_at ?? null)}</p>
          {integration?.last_error && (
            <p className="sm:col-span-2 text-destructive">Último erro: {integration.last_error}</p>
          )}
        </CardContent>
      </Card>

      {contractReady && (
        <Alert>
          <AlertDescription>
            A sincronização automática roda a cada {intervalLabel(currentMin)}: envia o sinal de funcionamento, busca e executa
            os comandos do Painel Master e envia o resumo de vendas a cada hora. Use "Sincronizar agora" para rodar na hora.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração</CardTitle>
          <CardDescription>Dados fornecidos pelo Painel Master para esta instalação.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mi-url">URL base da API</Label>
              <Input id="mi-url" type="url" placeholder="https://..." value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mi-id">ID da instalação</Label>
              <Input id="mi-id" placeholder="00000000-0000-0000-0000-000000000000" value={installationId} onChange={(e) => setInstallationId(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mi-token">Token de API</Label>
              <Input
                id="mi-token"
                type="password"
                autoComplete="off"
                placeholder={integration?.token_masked ? `Salvo: ${integration.token_masked} — deixe em branco para manter` : "Cole o token da instalação"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">O token fica guardado criptografado e nunca é exibido novamente.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mi-store">Nome da loja (opcional)</Label>
              <Input id="mi-store" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy !== null}>
                <Save className="h-4 w-4 mr-2" />{busy === "save" ? "Salvando..." : "Salvar configurações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5" />Sincronização automática</CardTitle>
          <CardDescription>Escolha de quanto em quanto tempo o PDV conversa com o Painel Master e por quanto tempo guardar o histórico.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mi-interval">Sincronizar a cada</Label>
              <Select value={intervalMin} onValueChange={setIntervalMin}>
                <SelectTrigger id="mi-interval"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>{intervalLabel(m)} ({perDay(m)}x por dia)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Um bloqueio ou liberação enviado pelo Master pode levar até {intervalLabel(Number(intervalMin))} para ser aplicado.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mi-retention">Guardar histórico por</Label>
              <Select value={retentionDays} onValueChange={setRetentionDays}>
                <SelectTrigger id="mi-retention"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RETENTION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} dias</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Todo dia às 03:00 os registros de execução e sinais de funcionamento mais antigos são apagados.
                Comandos, falhas e relatórios são mantidos.
              </p>
            </div>
          </div>
          <p className="text-sm"><span className="text-muted-foreground">Última limpeza:</span> {fmt(integration?.cleanup_last_at ?? null)}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveSyncSettings} disabled={busy !== null}>
              <Save className="h-4 w-4 mr-2" />{busy === "sync-settings" ? "Salvando..." : "Salvar tempos"}
            </Button>
            <Button variant="outline" onClick={() => void cleanupNow()} disabled={busy !== null}>
              <Eraser className="h-4 w-4 mr-2" />{busy === "cleanup" ? "Limpando..." : "Limpar agora"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastReply && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Última resposta do Painel Master</CardTitle>
            <CardDescription>HTTP {lastReply.http_status || "sem resposta"}{lastReply.message ? ` — ${lastReply.message}` : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(lastReply.response, null, 2) ?? "—"}</pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null || !integration?.has_token}
            onClick={() => verify("test")}>
            <Wifi className="h-4 w-4 mr-2" />Testar conexão
          </Button>
          <Button variant="outline" disabled={busy !== null || !integration?.has_token}
            onClick={() => verify("reconnect")}>
            <PlugZap className="h-4 w-4 mr-2" />Reconectar
          </Button>
          <Button variant="outline" disabled={busy !== null || !integration?.has_token}
            onClick={() => void syncNow()}>
            <RefreshCw className={`h-4 w-4 mr-2 ${busy === "sync" ? "animate-spin" : ""}`} />{busy === "sync" ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={busy !== null || !integration?.has_token}>
                <Unplug className="h-4 w-4 mr-2" />Desconectar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desconectar do Painel Master?</AlertDialogTitle>
                <AlertDialogDescription>
                  O token será apagado deste PDV. Os controles continuam no último estado recebido.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("disconnect", { action: "disconnect" }, "Integração desconectada")}>
                  Desconectar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {!integration?.has_token && (
            <p className="w-full text-xs text-muted-foreground flex items-center gap-1">
              <Link2 className="h-3 w-3" />Salve o token para liberar as ações.
            </p>
          )}
        </CardContent>
      </Card>
      <InstallationManager integration={integration} onChanged={onChanged} />
    </div>
  );
};
