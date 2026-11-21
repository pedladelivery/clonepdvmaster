import { useRef, useState } from "react";
import { Download, Link2, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { callMaster, MasterApiError } from "@/lib/masterApi";
import type { Integration } from "./IntegrationTab";

interface Props { integration: Integration | null; onChanged: () => void }

export const InstallationManager = ({ integration, onChanged }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ backup: unknown; id: string; created: string; overwrite: boolean } | null>(null);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [bind, setBind] = useState({ base_url: integration?.base_url ?? "", installation_id: "", token: "", store_name: "" });
  const linked = Boolean(integration?.installation_id);
  const fail = (title: string, err: unknown) => toast({ title, description: (err as Error).message, variant: "destructive" });

  const exportBackup = async () => {
    setBusy("export");
    try {
      const { backup } = await callMaster<{ backup: unknown }>("master-admin", { action: "export_backup" });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `backup-comunicacao-${integration?.installation_id?.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Backup exportado", description: "O token segue criptografado no arquivo." });
    } catch (err) { fail("Não foi possível exportar", err); } finally { setBusy(null); }
  };

  const pickFile = async (file: File) => {
    try {
      const backup = JSON.parse(await file.text());
      const id = String(backup?.config?.installation_id ?? "");
      setPending({ backup, id, created: String(backup?.created_at ?? ""), overwrite: linked && id !== integration?.installation_id });
    } catch { toast({ title: "Arquivo inválido", description: "Selecione um backup JSON.", variant: "destructive" }); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const restore = async () => {
    if (!pending) return;
    setBusy("import");
    try {
      await callMaster("master-admin", {
        action: "import_backup", backup: pending.backup, confirm_overwrite: pending.overwrite, expected_installation_id: pending.id,
      });
      toast({ title: "Backup restaurado", description: "Use Testar conexão para validar com o Painel Master." });
      onChanged();
    } catch (err) {
      fail(err instanceof MasterApiError && err.status === 409 ? "Restauração não autorizada" : "Não foi possível restaurar", err);
    } finally { setBusy(null); setPending(null); }
  };

  const prepare = async () => {
    setBusy("prepare");
    try {
      await callMaster("master-admin", { action: "prepare_new_installation", confirm: confirmText.trim() });
      toast({ title: "Ambiente preparado", description: "Informe o novo ID da instalação e a nova Key." });
      onChanged();
    } catch (err) { fail("Não foi possível preparar", err); } finally { setBusy(null); setPrepareOpen(false); setConfirmText(""); }
  };

  const bindNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("bind");
    try {
      const res = await callMaster<{ ok: boolean; message: string | null }>("master-admin", { action: "bind_installation", ...bind });
      toast(res.ok
        ? { title: "Nova instalação conectada", description: "Heartbeat e sincronização iniciados." }
        : { title: "Vinculada, mas o Painel Master recusou a validação", description: res.message ?? "", variant: "destructive" });
      setBind((b) => ({ ...b, token: "" }));
      onChanged();
    } catch (err) { fail("Não foi possível vincular", err); } finally { setBusy(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Gerenciamento da instalação</CardTitle>
        <CardDescription>Backup e troca da identidade de comunicação com o Painel Master. Vendas, mesas, produtos, estoque e usuários não são alterados.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null || !linked} onClick={() => void exportBackup()}>
            <Download className="h-4 w-4 mr-2" />{busy === "export" ? "Exportando..." : "Exportar backup"}
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />Restaurar backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); }} />
          <Button variant="destructive" disabled={busy !== null || !linked} onClick={() => setPrepareOpen(true)}>
            <RotateCcw className="h-4 w-4 mr-2" />Preparar nova instalação
          </Button>
        </div>

        {!linked && (
          <form onSubmit={bindNew} className="space-y-3 rounded-md border p-4">
            <p className="font-medium flex items-center gap-2"><Link2 className="h-4 w-4" />Vincular nova instalação</p>
            <div className="space-y-1"><Label htmlFor="bi-url">URL base da API</Label>
              <Input id="bi-url" type="url" required value={bind.base_url} onChange={(e) => setBind({ ...bind, base_url: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="bi-id">Novo ID da instalação</Label>
              <Input id="bi-id" required placeholder="00000000-0000-0000-0000-000000000000" value={bind.installation_id} onChange={(e) => setBind({ ...bind, installation_id: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="bi-token">Nova Key / token</Label>
              <Input id="bi-token" type="password" autoComplete="off" required value={bind.token} onChange={(e) => setBind({ ...bind, token: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="bi-store">Nome da loja (opcional)</Label>
              <Input id="bi-store" value={bind.store_name} onChange={(e) => setBind({ ...bind, store_name: e.target.value })} /></div>
            <Button type="submit" disabled={busy !== null}>{busy === "bind" ? "Conectando..." : "Conectar e iniciar"}</Button>
          </form>
        )}
      </CardContent>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar este backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Instalação {pending?.id || "—"}, criado em {pending?.created ? new Date(pending.created).toLocaleString("pt-BR") : "—"}.
              {pending?.overwrite && " Atenção: a instalação vinculada agora será substituída por esta."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void restore()}>{pending?.overwrite ? "Substituir e restaurar" : "Restaurar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={prepareOpen} onOpenChange={setPrepareOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preparar nova instalação?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove o ID, o token, todo o histórico de comandos e eventos e as outras sessões da área Master. Usuários Master,
              licença, controles e todos os dados da loja são mantidos. Exporte um backup antes. Digite PREPARAR para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="PREPARAR" />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={confirmText.trim() !== "PREPARAR"} onClick={() => void prepare()}>Preparar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
