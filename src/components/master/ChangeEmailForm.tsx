import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callMaster } from "@/lib/masterApi";

interface Props {
  currentEmail: string;
  onChanged: (email: string) => void;
}

export const ChangeEmailForm = ({ currentEmail, onChanged }: Props) => {
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (email.trim().toLowerCase() !== confirm.trim().toLowerCase()) {
      setError("A confirmação não confere com o novo e-mail.");
      return;
    }
    setBusy(true);
    try {
      const res = await callMaster<{ username: string }>("master-auth", {
        action: "change_email", new_email: email, current_password: password,
      });
      setEmail("");
      setConfirm("");
      setPassword("");
      onChanged(res.username);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-w-sm">
      <p className="text-sm"><span className="text-muted-foreground">E-mail atual:</span> {currentEmail}</p>
      <div className="space-y-2">
        <Label htmlFor="em-new">Novo e-mail</Label>
        <Input id="em-new" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="em-confirm">Confirmar novo e-mail</Label>
        <Input id="em-confirm" type="email" autoComplete="email" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="em-pw">Senha atual</Label>
        <Input id="em-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Trocar e-mail"}</Button>
    </form>
  );
};
