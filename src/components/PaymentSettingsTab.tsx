import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { QrCode, CreditCard, Trash2, Plus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { buildPixPayload } from "@/lib/pix";
import { useStore } from "@/contexts/StoreContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const db = supabase as any;
const BUILTIN = ["dinheiro", "cartao-credito", "cartao-debito", "pix"];

interface Method { id: string; code: string; name: string; kind: string; active: boolean; display_order: number }

export const PaymentSettingsTab = () => {
  const { toast } = useToast();
  const [methods, setMethods] = useState<Method[]>([]);
  const [newName, setNewName] = useState("");
  const [pixId, setPixId] = useState<string | null>(null);
  const [pix, setPix] = useState({ pix_key: "", receiver_name: "", receiver_city: "" });
  const { stores } = useStore();
  const [scope, setScope] = useState<string>("all");
  const storeId = scope === "all" ? null : scope;
  const [usesGlobalMethods, setUsesGlobalMethods] = useState(false);
  const [usesGlobalPix, setUsesGlobalPix] = useState(false);

  const byStore = (q: any) => (storeId ? q.eq("store_id", storeId) : q.is("store_id", null));

  /** Garante que as formas padrão existam na configuração geral. */
  const ensureBuiltins = async () => {
    const { data: g } = await db.from("payment_methods").select("code").is("store_id", null);
    const have = new Set((g || []).map((m: any) => m.code));
    const defaults = [
      { code: "dinheiro", name: "Dinheiro", kind: "cash" },
      { code: "cartao-credito", name: "Cartão de Crédito", kind: "card" },
      { code: "cartao-debito", name: "Cartão de Débito", kind: "card" },
      { code: "pix", name: "PIX", kind: "pix" },
    ];
    const missing = defaults.map((d, i) => ({ ...d, display_order: i, active: true, store_id: null })).filter((d) => !have.has(d.code));
    if (missing.length) await db.from("payment_methods").insert(missing);
  };

  const load = async () => {
    await ensureBuiltins();
    const { data } = await byStore(db.from("payment_methods").select("*")).order("display_order");
    if (storeId && !(data && data.length)) {
      const { data: g } = await db.from("payment_methods").select("*").is("store_id", null).order("display_order");
      setMethods(g || []); setUsesGlobalMethods(true);
    } else { setMethods(data || []); setUsesGlobalMethods(false); }
    let { data: p } = await byStore(db.from("pix_settings").select("*")).limit(1).maybeSingle();
    let global = false;
    if (!p && storeId) { p = (await db.from("pix_settings").select("*").is("store_id", null).limit(1).maybeSingle()).data; global = true; }
    setUsesGlobalPix(global);
    setPixId(p && !global ? p.id : null);
    setPix({ pix_key: p?.pix_key || "", receiver_name: p?.receiver_name || "", receiver_city: p?.receiver_city || "" });
  };
  useEffect(() => { load(); }, [scope]);

  /** Cria cópia própria da loja a partir das formas gerais. */
  const ensureOwnMethods = async (): Promise<Method[] | null> => {
    if (!storeId || !usesGlobalMethods) return methods;
    const rows = methods.map((m) => ({ code: m.code, name: m.name, kind: m.kind, active: m.active, display_order: m.display_order, store_id: storeId }));
    const { data, error } = await db.from("payment_methods").insert(rows).select("*");
    if (error) { err(error); return null; }
    setUsesGlobalMethods(false);
    return (data || []).sort((a: Method, b: Method) => a.display_order - b.display_order);
  };

  const resetToGlobal = async () => {
    if (!storeId || !confirm("Voltar esta loja para a configuração de todas as lojas?")) return;
    await db.from("payment_methods").delete().eq("store_id", storeId);
    await db.from("pix_settings").delete().eq("store_id", storeId);
    toast({ title: "Loja usando a configuração geral" });
    load();
  };

  const err = (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" });

  const savePix = async () => {
    const q = pixId ? db.from("pix_settings").update(pix).eq("id", pixId) : db.from("pix_settings").insert({ ...pix, store_id: storeId });
    const { error } = await q;
    if (error) return err(error);
    toast({ title: "Configuração PIX salva" });
    load();
  };

  const toggle = async (m: Method, active: boolean) => {
    const own = await ensureOwnMethods();
    if (!own) return;
    const target = own.find((x) => x.code === m.code);
    if (!target) return;
    const { error } = await db.from("payment_methods").update({ active }).eq("id", target.id);
    if (error) return err(error);
    setMethods(own.map((x) => (x.id === target.id ? { ...x, active } : x)));
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const code = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);
    if (!(await ensureOwnMethods())) return;
    const { error } = await db.from("payment_methods").insert({ name, code, kind: "other", display_order: methods.length + 1, store_id: storeId });
    if (error) return err(error);
    setNewName("");
    load();
  };

  const remove = async (m: Method) => {
    if (!confirm(`Excluir "${m.name}"?`)) return;
    const own = await ensureOwnMethods();
    if (!own) return;
    const target = own.find((x) => x.code === m.code);
    const { error } = await db.from("payment_methods").delete().eq("id", target?.id ?? m.id);
    if (error) return err(error);
    load();
  };

  const preview = pix.pix_key && pix.receiver_name
    ? buildPixPayload({ key: pix.pix_key, name: pix.receiver_name, city: pix.receiver_city || "BRASIL", amount: 0 })
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-2">
          <Label>Configurar para</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as lojas (padrão)</SelectItem>
              {stores.map((st) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {storeId
              ? (usesGlobalMethods && usesGlobalPix
                  ? "Esta loja usa a configuração de todas as lojas. Ao alterar algo aqui, ela passa a ter configuração própria."
                  : "Esta loja tem configuração própria" + (usesGlobalMethods ? " de PIX (formas de pagamento seguem o padrão)." : usesGlobalPix ? " de formas de pagamento (PIX segue o padrão)." : "."))
              : "Vale para todas as lojas que não tiverem configuração própria."}
          </p>
          {storeId && !(usesGlobalMethods && usesGlobalPix) && (
            <Button variant="outline" size="sm" onClick={resetToGlobal}>Voltar a usar a configuração de todas as lojas</Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Configuração PIX</CardTitle>
          <CardDescription>O QR code é gerado na hora do fechamento já com o valor do pedido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Nome do Recebedor</Label>
            <Input value={pix.receiver_name} onChange={(e) => setPix({ ...pix, receiver_name: e.target.value })} placeholder="Nome igual ao da conta" /></div>
          <div className="space-y-2"><Label>Chave PIX</Label>
            <Input value={pix.pix_key} onChange={(e) => setPix({ ...pix, pix_key: e.target.value })} placeholder="CPF, CNPJ, e-mail, +55telefone ou chave aleatória" />
            <p className="text-xs text-muted-foreground">Telefone deve ter o formato +5521999999999.</p></div>
          <div className="space-y-2"><Label>Cidade do Recebedor</Label>
            <Input value={pix.receiver_city} onChange={(e) => setPix({ ...pix, receiver_city: e.target.value })} placeholder="Ex.: Rio de Janeiro" /></div>
          {preview && (
            <div className="inline-block p-2 border rounded-lg bg-card"><QRCodeSVG value={preview} size={120} /></div>
          )}
          <div><Button onClick={savePix}>Salvar Configuração PIX</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Formas de Pagamento Disponíveis</CardTitle>
          <CardDescription>Ative ou desative as formas de pagamento que aparecem no fechamento do pedido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {methods.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
              <span>{m.name}</span>
              <div className="flex items-center gap-3">
                <Switch checked={m.active} onCheckedChange={(v) => toggle(m, v)} />
                {!BUILTIN.includes(m.code) && (
                  <Button size="icon" variant="ghost" onClick={() => remove(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova forma de pagamento (ex.: Vale-refeição)" onKeyDown={(e) => e.key === "Enter" && add()} />
            <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
