import { useState } from "react";
import { CreditCard, LogOut, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MySubscription } from "@/components/MySubscription";
import { useAuth } from "@/contexts/AuthContext";
import { LICENSE_SUSPENDED_DETAIL, LICENSE_SUSPENDED_TEXT, LICENSE_SUSPENDED_TITLE } from "@/lib/license";

interface Props {
  /** Whether this user may open Minha Assinatura (owner or "subscription" permission). */
  canOpenSubscription: boolean;
}

/** Shown instead of the whole PDV while the Painel Master keeps the license suspended. */
export const LicenseSuspendedScreen = ({ canOpenSubscription }: Props) => {
  const { signOut } = useAuth();
  const [showSubscription, setShowSubscription] = useState(false);

  if (showSubscription) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background">
        <MySubscription onBackToMain={() => setShowSubscription(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-destructive/40 shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldOff className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-2xl">{LICENSE_SUSPENDED_TITLE}</CardTitle>
          <CardDescription className="text-base text-foreground">{LICENSE_SUSPENDED_TEXT}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-sm text-muted-foreground">{LICENSE_SUSPENDED_DETAIL}</p>
          {canOpenSubscription ? (
            <Button className="w-full" size="lg" onClick={() => setShowSubscription(true)}>
              <CreditCard className="mr-2 h-5 w-5" />
              Minha Assinatura
            </Button>
          ) : (
            <p className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
              Peça ao responsável pelo estabelecimento para consultar Minha Assinatura.
            </p>
          )}
          <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
