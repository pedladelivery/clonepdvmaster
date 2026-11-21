import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MasterLogin } from "@/components/master/MasterLogin";
import { ChangePasswordForm } from "@/components/master/ChangePasswordForm";
import { IntegrationTab, type Integration } from "@/components/master/IntegrationTab";
import { ControlsTab } from "@/components/master/ControlsTab";
import { HistoryTab } from "@/components/master/HistoryTab";
import { AccessTab } from "@/components/master/AccessTab";
import { SystemTab } from "@/components/master/SystemTab";
import { MasterPdvAccessProvider, MasterPdvGate } from "@/components/master/MasterPdvAccess";
import { Reports } from "@/components/Reports";
import { MySubscription } from "@/components/MySubscription";
import { callMaster, masterSession } from "@/lib/masterApi";
import type { PdvControl } from "@/lib/pdvControls";

type Phase = "checking" | "login" | "change_password" | "ready";

const Master = () => {
  const [phase, setPhase] = useState<Phase>("checking");
  const [username, setUsername] = useState("");
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [controls, setControls] = useState<PdvControl[]>([]);
  const [contractReady, setContractReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState("integration");
  const backToFirstTab = () => setTab("integration");

  useEffect(() => {
    document.title = "Área Master — PDV Salão";
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const res = await callMaster<{ integration: Integration; controls: PdvControl[]; contract_ready: boolean }>(
        "master-admin",
        { action: "overview" },
      );
      setIntegration(res.integration);
      setControls(res.controls ?? []);
      setContractReady(Boolean(res.contract_ready));
      setLoadError(null);
    } catch (err) {
      if (!masterSession.get()) setPhase("login");
      else setLoadError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!masterSession.get()) {
      setPhase("login");
      return;
    }
    callMaster<{ username: string; must_change_password: boolean }>("master-auth", { action: "session" })
      .then((s) => {
        setUsername(s.username);
        setPhase(s.must_change_password ? "change_password" : "ready");
      })
      .catch(() => setPhase("login"));
  }, []);

  useEffect(() => {
    if (phase === "ready") void loadOverview();
  }, [phase, loadOverview]);

  const signOut = async () => {
    try {
      await callMaster("master-auth", { action: "logout" });
    } catch {
      /* session may already be gone */
    }
    masterSession.clear();
    setPhase("login");
  };

  if (phase === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (phase === "login") {
    return (
      <MasterLogin
        onLoggedIn={(info) => {
          setUsername(info.username);
          setPhase(info.must_change_password ? "change_password" : "ready");
        }}
      />
    );
  }

  if (phase === "change_password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Troque a senha inicial</CardTitle>
            <CardDescription>Por segurança, defina uma nova senha antes de usar a área Master.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChangePasswordForm onChanged={() => setPhase("ready")} />
            <Button variant="ghost" size="sm" onClick={signOut}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="bg-card border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-6 w-6 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold leading-tight">Área Master</h1>
              <p className="text-xs text-muted-foreground truncate">Conectado como {username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/">Voltar ao PDV</Link></Button>
            <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" />Sair</Button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loadError && <p className="mb-4 text-sm text-destructive">{loadError}</p>}
        <MasterPdvAccessProvider>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="integration">Integração</TabsTrigger>
            <TabsTrigger value="controls">Controles</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
            <TabsTrigger value="subscription">Minha Assinatura</TabsTrigger>
            <TabsTrigger value="system">Sistema</TabsTrigger>
            <TabsTrigger value="access">Configurações de acesso</TabsTrigger>
          </TabsList>
          <TabsContent value="integration" className="mt-4">
            <IntegrationTab integration={integration} contractReady={contractReady} onChanged={loadOverview} />
          </TabsContent>
          <TabsContent value="controls" className="mt-4">
            <ControlsTab controls={controls} />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <HistoryTab />
          </TabsContent>
          <TabsContent value="reports" className="mt-4">
            <MasterPdvGate><div className="rounded-lg border bg-card"><Reports onBackToMain={backToFirstTab} /></div></MasterPdvGate>
          </TabsContent>
          <TabsContent value="subscription" className="mt-4">
            <MasterPdvGate><div className="rounded-lg border bg-card"><MySubscription onBackToMain={backToFirstTab} /></div></MasterPdvGate>
          </TabsContent>
          <TabsContent value="system" className="mt-4">
            <MasterPdvGate><SystemTab /></MasterPdvGate>
          </TabsContent>
          <TabsContent value="access" className="mt-4">
            <AccessTab username={username} onSignedOut={() => setPhase("login")} onEmailChanged={setUsername} />
          </TabsContent>
        </Tabs>
        </MasterPdvAccessProvider>
      </main>
    </div>
  );
};

export default Master;
