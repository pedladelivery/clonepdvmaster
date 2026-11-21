import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { callMaster, masterSession } from "@/lib/masterApi";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ChangeEmailForm } from "./ChangeEmailForm";

interface Props {
  username: string;
  onSignedOut: () => void;
  onEmailChanged: (email: string) => void;
}

export const AccessTab = ({ username, onSignedOut, onEmailChanged }: Props) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const revokeAll = async () => {
    setBusy(true);
    try {
      await callMaster("master-auth", { action: "revoke_all" });
      masterSession.clear();
      toast({ title: "Todas as sessões foram encerradas" });
      onSignedOut();
    } catch (err) {
      toast({ title: "Não foi possível encerrar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trocar e-mail de acesso</CardTitle>
          <CardDescription>O novo e-mail passa a ser usado para entrar na área Master. As outras sessões abertas serão encerradas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeEmailForm
            currentEmail={username}
            onChanged={(email) => {
              onEmailChanged(email);
              toast({ title: "E-mail alterado", description: `Use ${email} no próximo acesso.` });
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trocar senha</CardTitle>
          <CardDescription>As outras sessões abertas serão encerradas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm onChanged={() => toast({ title: "Senha alterada" })} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sessões</CardTitle>
          <CardDescription>Encerra o acesso à área Master em todos os aparelhos, inclusive este.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={revokeAll} disabled={busy}>
            <LogOut className="h-4 w-4 mr-2" />Encerrar todas as sessões
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
