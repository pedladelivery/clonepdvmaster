import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mail, KeyRound, ShieldCheck, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type PendingAction = "email" | "password" | null;

export const AccountSecurityTab = () => {
  const { toast } = useToast();

  const [currentEmail, setCurrentEmail] = useState("");
  const [fullName, setFullName] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [pending, setPending] = useState<PendingAction>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentEmail(user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setFullName(data?.full_name ?? "");
    })();
  }, []);

  const friendlyError = (message?: string) => {
    const m = (message ?? "").toLowerCase();
    if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
      return "Senha atual incorreta.";
    }
    if (m.includes("already registered") || m.includes("already been registered") || m.includes("already exists")) {
      return "Este e-mail já está sendo utilizado por outra conta.";
    }
    if (m.includes("invalid email") || m.includes("email address")) {
      return "Informe um endereço de e-mail válido.";
    }
    if (m.includes("should be different") || m.includes("same as the old")) {
      return "A nova senha deve ser diferente da senha atual.";
    }
    if (m.includes("weak") || m.includes("at least")) {
      return "A nova senha não atende aos requisitos mínimos de segurança.";
    }
    if (m.includes("rate limit") || m.includes("too many")) {
      return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
    }
    return "Não foi possível concluir a alteração. Tente novamente.";
  };

  // Reautentica o usuário atual usando o e-mail da sessão (nunca um ID informado).
  const reauthenticate = async (password: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false, error: "Erro de autenticação. Faça login novamente." };
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (error) return { ok: false, error: friendlyError(error.message) };
    return { ok: true as const, error: null };
  };

  const validateEmailForm = () => {
    if (!newEmail.trim()) return "Informe o novo e-mail.";
    if (!EMAIL_REGEX.test(newEmail.trim())) return "Informe um endereço de e-mail válido.";
    if (newEmail.trim().toLowerCase() === currentEmail.toLowerCase()) {
      return "O novo e-mail é igual ao e-mail atual.";
    }
    if (!emailPassword) return "Informe a senha atual para confirmar.";
    return null;
  };

  const validatePasswordForm = () => {
    if (!currentPassword) return "Informe a senha atual.";
    if (newPassword.length < 8) return "A nova senha deve ter pelo menos 8 caracteres.";
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return "A nova senha deve conter letras e números.";
    }
    if (newPassword !== confirmPassword) return "As senhas não conferem.";
    if (newPassword === currentPassword) return "A nova senha deve ser diferente da senha atual.";
    return null;
  };

  const requestEmailChange = () => {
    const problem = validateEmailForm();
    if (problem) {
      toast({ title: problem, variant: "destructive" });
      return;
    }
    setPending("email");
  };

  const requestPasswordChange = () => {
    const problem = validatePasswordForm();
    if (problem) {
      toast({ title: problem, variant: "destructive" });
      return;
    }
    setPending("password");
  };

  const confirmEmailChange = async () => {
    setPending(null);
    setEmailBusy(true);
    try {
      const auth = await reauthenticate(emailPassword);
      if (!auth.ok) {
        toast({ title: auth.error!, variant: "destructive" });
        return;
      }
      const target = newEmail.trim().toLowerCase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Erro de autenticação. Faça login novamente.", variant: "destructive" });
        return;
      }
      // Troca direta, confirmada pela senha atual (sem e-mail de confirmação)
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { user_id: user.id, email: target },
      });
      if (error || (data as any)?.error) {
        let msg = (data as any)?.error ?? error?.message;
        try { msg = (await (error as any)?.context?.json())?.error ?? msg; } catch { /* ignore */ }
        toast({ title: msg || "Não foi possível alterar o e-mail.", variant: "destructive" });
        return;
      }
      await supabase.auth.refreshSession();
      setCurrentEmail(target);
      setNewEmail("");
      toast({ title: "E-mail alterado com sucesso!", description: "Use o novo e-mail no próximo login." });
    } catch {
      toast({
        title: "Não foi possível concluir a alteração. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setEmailPassword("");
      setEmailBusy(false);
    }
  };

  const confirmPasswordChange = async () => {
    setPending(null);
    setPasswordBusy(true);
    try {
      const auth = await reauthenticate(currentPassword);
      if (!auth.ok) {
        toast({ title: auth.error!, variant: "destructive" });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: friendlyError(error.message), variant: "destructive" });
        return;
      }
      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua sessão foi renovada com a nova senha.",
      });
    } catch {
      toast({
        title: "Não foi possível concluir a alteração. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5" />
            Dados da Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-sm text-muted-foreground">E-mail atual</span>
            <span className="text-sm font-medium break-all">{currentEmail || "—"}</span>
          </div>
          <Separator />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-sm text-muted-foreground">Nome</span>
            <span className="text-sm font-medium">{fullName || "—"}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Administrador Geral
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Alterar E-mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-new-email">Novo e-mail</Label>
            <Input
              id="account-new-email"
              type="email"
              autoComplete="off"
              placeholder="novo@email.com"
              value={newEmail}
              maxLength={255}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={emailBusy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-email-password">Senha atual</Label>
            <Input
              id="account-email-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={emailPassword}
              maxLength={128}
              onChange={(e) => setEmailPassword(e.target.value)}
              disabled={emailBusy}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O novo e-mail passa a valer na hora. A troca é confirmada pela sua senha atual.
          </p>
          <Button onClick={requestEmailChange} disabled={emailBusy}>
            {emailBusy ? "Alterando..." : "Alterar e-mail"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-current-password">Senha atual</Label>
            <Input
              id="account-current-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={currentPassword}
              maxLength={128}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordBusy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-new-password">Nova senha</Label>
            <Input
              id="account-new-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={newPassword}
              maxLength={128}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordBusy}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 8 caracteres, com letras e números.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-confirm-password">Confirmar nova senha</Label>
            <Input
              id="account-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              maxLength={128}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordBusy}
            />
          </div>
          <Button onClick={requestPasswordChange} disabled={passwordBusy}>
            {passwordBusy ? "Alterando..." : "Alterar senha"}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Você está prestes a alterar as credenciais de acesso do Administrador Geral. Deseja continuar?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "email"
                ? "Após a alteração, poderá ser necessário confirmar o novo e-mail através do link enviado."
                : "Após alterar a senha, sua sessão poderá precisar ser renovada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={pending === "email" ? confirmEmailChange : confirmPasswordChange}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
