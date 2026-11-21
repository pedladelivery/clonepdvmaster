import { useEffect, useRef, useState } from "react";
import { clearDeviceCaches } from "@/lib/deviceCaches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Shield, Database, Download, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/lib/dbClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { fetchStoreSettingsRow } from "@/lib/storeSettings";
import { exportBackup, downloadBackup, parseBackupFile, importBackup } from "@/lib/backupData";
import {
  DATA_MODULES,
  type DataModule,
  type ModuleId,
  exportModule,
  downloadModuleBackup,
  parseModuleBackup,
  importModule,
  clearModule,
  clearAllModules,
} from "@/lib/dataModules";

/** Copy of the "Sistema" tab from Configurações, shown inside /master. Same actions, same PDV permissions. */
export const SystemTab = () => {
  const { toast } = useToast();
  const { scopeStoreId, writeStoreId } = useStore();
  const storeId = scopeStoreId ?? writeStoreId ?? null;
  const [autoBackup, setAutoBackup] = useState(true);
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);
  const [savingAutoBackup, setSavingAutoBackup] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const moduleInputRef = useRef<HTMLInputElement>(null);
  const [moduleBusy, setModuleBusy] = useState<string | null>(null);
  const [restoreModuleId, setRestoreModuleId] = useState<ModuleId | null>(null);

  const loadAutoBackup = async () => {
    try {
      const { data } = await fetchStoreSettingsRow(storeId, "id, auto_backup");
      setSettingsRowId((data as any)?.id ?? null);
      setAutoBackup((data as any)?.auto_backup ?? true);
    } catch {
      /* keeps the default, same as Configurações */
    }
  };

  useEffect(() => {
    void loadAutoBackup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Saves only this switch on the settings row the store is using (its own or the general one).
  const saveAutoBackup = async (checked: boolean) => {
    const previous = autoBackup;
    setAutoBackup(checked);
    setSavingAutoBackup(true);
    try {
      if (!settingsRowId) throw new Error("Salve as configurações da loja no PDV antes de alterar esta opção.");
      const { error } = await supabase.from("store_settings").update({ auto_backup: checked }).eq("id", settingsRowId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Configurações salvas com sucesso" });
    } catch (error: any) {
      setAutoBackup(previous);
      toast({ title: "Erro", description: error?.message ?? "Não foi possível salvar", variant: "destructive" });
    } finally {
      setSavingAutoBackup(false);
    }
  };

  const exportData = async () => {
    try {
      setExporting(true);
      toast({
        title: "Exportação iniciada",
        description: "Os dados estão sendo preparados para download",
      });

      const backup = await exportBackup();
      downloadBackup(backup);

      const total = Object.values(backup.data).reduce(
        (sum, rows) => sum + (rows as any[]).length,
        0
      );
      toast({
        title: "Exportação concluída",
        description: `${total} registros salvos no arquivo de backup`,
      });
    } catch (error: any) {
      console.error("Error exporting data:", error);
      toast({
        title: "Erro",
        description: error?.message ?? "Não foi possível exportar os dados",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const confirmed = window.confirm(
      "Importar este backup irá adicionar e sobrescrever registros existentes com o mesmo identificador. Deseja continuar?"
    );
    if (!confirmed) return;

    try {
      setImporting(true);
      const backup = parseBackupFile(await file.text());
      const results = await importBackup(backup);
      const failed = results.filter((r) => r.error);
      const total = results.reduce((sum, r) => sum + r.count, 0);

      if (failed.length > 0) {
        toast({
          title: "Importação parcial",
          description: `${total} registros restaurados. Falhas em: ${failed
            .map((f) => f.table)
            .join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Importação concluída",
          description: `${total} registros restaurados com sucesso`,
        });
      }
      await loadAutoBackup();
    } catch (error: any) {
      console.error("Error importing data:", error);
      toast({
        title: "Erro",
        description: error?.message ?? "Arquivo de backup inválido",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const backupModule = async (mod: DataModule) => {
    try {
      setModuleBusy(`export-${mod.id}`);
      const backup = await exportModule(mod);
      downloadModuleBackup(backup);
      const total = Object.values(backup.data).reduce((s, r) => s + r.length, 0);
      toast({
        title: `Backup de ${mod.label} concluído`,
        description: `${total} registros salvos no arquivo`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message ?? "Não foi possível gerar o backup",
        variant: "destructive",
      });
    } finally {
      setModuleBusy(null);
    }
  };

  const handleModuleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const mod = DATA_MODULES.find((m) => m.id === restoreModuleId);
    setRestoreModuleId(null);
    if (!file || !mod) return;

    if (
      !window.confirm(
        `Restaurar o backup de ${mod.label}? Registros existentes com o mesmo identificador serão sobrescritos.`
      )
    )
      return;

    try {
      setModuleBusy(`import-${mod.id}`);
      const backup = parseModuleBackup(await file.text(), mod);
      const total = await importModule(mod, backup);
      toast({
        title: `${mod.label} restaurado`,
        description: `${total} registros restaurados com sucesso`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message ?? "Arquivo de backup inválido",
        variant: "destructive",
      });
    } finally {
      setModuleBusy(null);
    }
  };

  const clearModuleData = async (mod: DataModule) => {
    if (
      !window.confirm(
        `ATENÇÃO: todos os dados de ${mod.label} serão apagados permanentemente. Recomendamos fazer o backup antes. Continuar?`
      )
    )
      return;
    if (!window.confirm(`Confirmação final: apagar todos os dados de ${mod.label}?`)) return;

    try {
      setModuleBusy(`clear-${mod.id}`);
      const { hiddenProducts } = await clearModule(mod);
      toast({
        title: `${mod.label} limpo`,
        description:
          hiddenProducts > 0
            ? `Os dados foram removidos. ${hiddenProducts} produto(s) aparecem em vendas antigas e foram apenas ocultados. Para apagá-los de vez, limpe Vendas antes.`
            : "Os dados foram removidos com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message ?? "Não foi possível limpar os dados",
        variant: "destructive",
      });
    } finally {
      setModuleBusy(null);
    }
  };


  const factoryReset = async () => {
    if (!window.confirm(
      "ATENÇÃO MÁXIMA: TODO o sistema será apagado — lojas, usuários, cardápio, vendas, clientes, fotos e configurações. Fica só a conta do primeiro super administrador. Não há como desfazer. Continuar?"
    )) return;
    const typed = window.prompt('Para confirmar, digite exatamente: APAGAR TUDO');
    if (typed !== "APAGAR TUDO") {
      toast({ title: "Cancelado", description: "O texto de confirmação não confere." });
      return;
    }
    try {
      setModuleBusy("factory");
      const { data, error } = await supabase.functions.invoke("factory-reset", { body: { confirm: "APAGAR TUDO" } });
      if (error || (data as any)?.error) {
        let msg = (data as any)?.error ?? error?.message;
        try { msg = (await (error as any)?.context?.json())?.error ?? msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      clearDeviceCaches();
      toast({ title: "Sistema apagado", description: "Tudo foi zerado. A página será recarregada." });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message ?? "Não foi possível apagar o sistema", variant: "destructive" });
    } finally {
      setModuleBusy(null);
    }
  };

  const clearData = async () => {
    const confirmed = window.confirm(
      "ATENÇÃO: serão apagados vendas, clientes e todo o cardápio (categorias, produtos e complementos). Esta operação não pode ser desfeita. Recomendamos exportar os dados antes. Continuar?"
    );
    if (!confirmed) return;
    if (!window.confirm("ÚLTIMA CONFIRMAÇÃO: todos esses dados serão perdidos permanentemente. Prosseguir?")) return;

    try {
      setModuleBusy("clear-all");
      await clearAllModules();
      toast({
        title: "Dados limpos",
        description: "Vendas, clientes e cardápio foram apagados. Lojas, usuários e configurações foram mantidos.",
      });
    } catch (error: any) {
      console.error("Error clearing data:", error);
      toast({
        title: "Erro",
        description: error?.message ?? "Não foi possível limpar os dados",
        variant: "destructive",
      });
    } finally {
      setModuleBusy(null);
    }
  };

  return (
    <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_backup">Backup Automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Realizar backup automático dos dados diariamente
                  </p>
                </div>
                <Switch
                  id="auto_backup"
                  checked={autoBackup}
                  disabled={savingAutoBackup}
                  onCheckedChange={(checked) => void saveAutoBackup(checked)}
                />
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <h4 className="font-medium">Gerenciamento de Dados</h4>
                <div className="flex flex-col gap-2">
                  <Button onClick={exportData} variant="outline" disabled={exporting || importing}>
                    <Database className="w-4 h-4 mr-2" />
                    {exporting ? "Exportando..." : "Exportar Dados"}
                  </Button>
                  <Button
                    onClick={() => importInputRef.current?.click()}
                    variant="outline"
                    disabled={exporting || importing}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    {importing ? "Importando..." : "Importar Dados"}
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <p className="text-xs text-muted-foreground">
                    A exportação gera um arquivo .json com produtos, categorias, vendas,
                    clientes e configurações. Use esse arquivo na importação para restaurar.
                  </p>
                  <Button onClick={clearData} variant="destructive" disabled={moduleBusy !== null}>
                    <Shield className="w-4 h-4 mr-2" />
                    {moduleBusy === "clear-all" ? "Limpando..." : "Limpar Todos os Dados"}
                  </Button>
                  <Button onClick={factoryReset} variant="destructive" disabled={moduleBusy !== null} className="mt-2">
                    <Shield className="w-4 h-4 mr-2" />
                    {moduleBusy === "factory" ? "Apagando o sistema..." : "Apagar todo o sistema (voltar ao zero)"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Apaga lojas, usuários, cardápio, vendas, clientes, fotos e todas as configurações.
                    Fica só a conta do primeiro super administrador. Só ele pode usar este botão.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Gerenciamento Individual</h4>
                <p className="text-xs text-muted-foreground">
                  Faça backup, restaure ou limpe cada área do sistema separadamente.
                </p>
                {DATA_MODULES.map((mod) => (
                  <div key={mod.id} className="rounded-lg border p-3 space-y-3">
                    <div>
                      <p className="font-medium">{mod.label}</p>
                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={moduleBusy !== null}
                        onClick={() => backupModule(mod)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {moduleBusy === `export-${mod.id}` ? "Gerando..." : "Backup"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={moduleBusy !== null}
                        onClick={() => {
                          setRestoreModuleId(mod.id);
                          setTimeout(() => moduleInputRef.current?.click(), 0);
                        }}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {moduleBusy === `import-${mod.id}` ? "Restaurando..." : "Restaurar"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={moduleBusy !== null}
                        onClick={() => clearModuleData(mod)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {moduleBusy === `clear-${mod.id}` ? "Limpando..." : "Limpar"}
                      </Button>
                    </div>
                  </div>
                ))}
                <input
                  ref={moduleInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleModuleImportFile}
                />
              </div>

            </CardContent>
          </Card>
    </div>
  );
};
