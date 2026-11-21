import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Banknote, QrCode, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { buildPixPayload } from "@/lib/pix";
import { useStore } from "@/contexts/StoreContext";

const FALLBACK = [
  { code: "dinheiro", name: "Dinheiro", kind: "cash" },
  { code: "cartao-credito", name: "Cartão de Crédito", kind: "card" },
  { code: "cartao-debito", name: "Cartão de Débito", kind: "card" },
  { code: "pix", name: "PIX", kind: "pix" },
];

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (paymentMethod: string, shouldPrint: boolean, amountReceived?: number) => void;
  total: number;
}

export const PaymentMethodDialog = ({
  open,
  onOpenChange,
  onConfirm,
  total
}: PaymentMethodDialogProps) => {
  const [paymentMethod, setPaymentMethod] = useState<string>("dinheiro");
  const [shouldPrint, setShouldPrint] = useState(true);
  const [receivedText, setReceivedText] = useState("");
  const [methods, setMethods] = useState<{ code: string; name: string; kind: string }[]>(FALLBACK);
  const [pixCfg, setPixCfg] = useState<any>(null);
  const [showQr, setShowQr] = useState(false);
  const { scopeStoreId, writeStoreId } = useStore();
  const sid = scopeStoreId ?? writeStoreId;

  useEffect(() => {
    if (open) {
      setShouldPrint(true);
      setReceivedText("");
      setShowQr(false);
      (async () => {
        const db = supabase as any;
        let data: any[] | null = null;
        if (sid) {
          const { data: own } = await db.from("payment_methods").select("code,name,kind,active").eq("store_id", sid).order("display_order");
          if (own && own.length) data = own.filter((m: any) => m.active);
        }
        if (!data) {
          const { data: g } = await db.from("payment_methods").select("code,name,kind").is("store_id", null).eq("active", true).order("display_order");
          data = g;
        }
        const list = data && data.length ? data : FALLBACK;
        setMethods(list);
        setPaymentMethod(list[0].code);
        let p: any = null;
        if (sid) p = (await db.from("pix_settings").select("*").eq("store_id", sid).maybeSingle()).data;
        if (!p?.pix_key) p = (await db.from("pix_settings").select("*").is("store_id", null).limit(1).maybeSingle()).data;
        setPixCfg(p);
      })();
    }
  }, [open, sid]);

  const selectedKind = methods.find((m) => m.code === paymentMethod)?.kind;
  const pixPayload = pixCfg?.pix_key
    ? buildPixPayload({ key: pixCfg.pix_key, name: pixCfg.receiver_name || "RECEBEDOR", city: pixCfg.receiver_city || "BRASIL", amount: total })
    : "";
  useEffect(() => { setShowQr(false); }, [paymentMethod]);

  const parsed = Number(String(receivedText).replace(",", "."));
  const received = receivedText.trim() !== "" && !Number.isNaN(parsed) ? parsed : null;
  const troco = received !== null ? received - total : null;
  const insufficient = selectedKind === "cash" && received !== null && received < total;

  const handleConfirm = () => {
    onConfirm(paymentMethod, shouldPrint, selectedKind === "cash" ? received ?? undefined : undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Forma de Pagamento</DialogTitle>
          <DialogDescription>
            Total da venda: R$ {total.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
            {methods.map((m) => {
              const Icon = m.kind === "cash" ? Banknote : m.kind === "pix" ? QrCode : CreditCard;
              return (
                <div key={m.code} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                  <RadioGroupItem value={m.code} id={`pm-${m.code}`} />
                  <Label htmlFor={`pm-${m.code}`} className="flex items-center gap-2 cursor-pointer flex-1">
                    <Icon className="h-5 w-5" />
                    <span>{m.name}</span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {selectedKind === "pix" && (
            <div className="p-3 border rounded-lg space-y-3 bg-accent/20 text-center">
              {!pixCfg?.pix_key ? (
                <p className="text-sm text-muted-foreground">Configure a chave PIX em Configurações → Pagamentos.</p>
              ) : !showQr ? (
                <Button type="button" variant="secondary" onClick={() => setShowQr(true)}>
                  <QrCode className="h-4 w-4 mr-2" /> Gerar QR Code PIX
                </Button>
              ) : (
                <>
                  <div className="inline-block p-3 bg-card rounded-lg border">
                    <QRCodeSVG value={pixPayload} size={220} />
                  </div>
                  <p className="text-sm font-semibold">R$ {total.toFixed(2)} — {pixCfg.receiver_name}</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(pixPayload)}>
                    Copiar PIX Copia e Cola
                  </Button>
                </>
              )}
            </div>
          )}

          {selectedKind === "cash" && (
            <div className="p-3 border rounded-lg space-y-2 bg-accent/20">
              <Label htmlFor="amount-received">Valor recebido</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  id="amount-received"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={receivedText}
                  onChange={(e) => setReceivedText(e.target.value)}
                  placeholder="0,00"
                  className="pl-10 text-lg font-semibold"
                />
              </div>
              {received !== null && !insufficient && (
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm font-semibold">Troco:</span>
                  <span className="text-lg font-bold text-green-600">R$ {troco?.toFixed(2)}</span>
                </div>
              )}
              {insufficient && (
                <p className="text-xs text-destructive">
                  Valor recebido é menor que o total (R$ {total.toFixed(2)}).
                </p>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2 p-3 border rounded-lg bg-accent/20">
            <input
              type="checkbox"
              id="shouldPrint"
              checked={shouldPrint}
              onChange={(e) => setShouldPrint(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <Label htmlFor="shouldPrint" className="flex items-center gap-2 cursor-pointer flex-1">
              <Printer className="h-5 w-5" />
              <span>Imprimir comanda após finalizar</span>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={insufficient}>
            Confirmar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
