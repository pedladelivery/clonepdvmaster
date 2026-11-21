import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, CreditCard, Receipt, RefreshCw, History, ShieldCheck, Store, Loader2, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/lib/dbClient";
import {
  readSubscription, normalizeStatus, STATUS_LABEL, formatMoney, formatDate, formatPeriod,
  readList, financeStatusLabel, canPayCharge, chargeKind, chargeNotice, splitCharges, chargeReference, dedupeById, keepLastValid,
  type SubscriptionStatus, type FinanceList,
} from "@/lib/subscriptionView";
import { useToast } from "@/hooks/use-toast";
import { prepareTab, openPreparedTab, isOfficialCheckout } from "@/lib/checkoutWindow";

type ServiceState =
  | "ok" | "not_published" | "not_found" | "auth_failed" | "unauthorized_installation" | "temporary_error" | "error";
interface ServiceReply { state: ServiceState; code?: string | null; http_status: number; message: string | null; data: unknown }
interface Identity {
  installation_id: string; installation_name: string | null; product: string | null;
  store_id: string | null; store_name: string | null; store_status: string | null;
  license_status: string | null; license_active: boolean | null;
  license_valid_from: string | null; license_valid_until: string | null; license_message: string | null;
}
interface SubscriptionReply {
  configured: boolean;
  refused?: string;
  checked_at?: string;
  identity?: Identity | null;
  verify?: { state: ServiceState; http_status: number; message: string | null };
  subscription?: ServiceReply;
  billing?: ServiceReply;
  history?: ServiceReply;
}

const CACHE_KEY = "pdv-subscription-last-valid";
const AUTO_REFRESH_MS = 5 * 60_000;
/** After a checkout is opened, the screen checks more often until the Master confirms it. */
const WATCH_REFRESH_MS = 30_000;
const WATCH_WINDOW_MS = 30 * 60_000;
const FOCUS_MIN_GAP_MS = 60_000;

const humanize = (k: string) => k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const isHttps = (v: string) => /^https:\/\/[^\s]+$/i.test(v);

/** Shows exactly what the Painel Master returned — no fields are assumed. */
const DataList = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "string" && isHttps(value)) {
    return <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">Abrir</a>;
  }
  if (typeof value !== "object") return <span className="break-words">{String(value)}</span>;
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i + 1), v] as const) : Object.entries(value as object);
  if (entries.length === 0) return <span className="text-muted-foreground">Nenhum registro</span>;
  return (
    <dl className="grid gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="grid gap-1 sm:grid-cols-[200px_1fr] border-b border-border pb-2 last:border-0">
          <dt className="text-sm text-muted-foreground">{humanize(k)}</dt>
          <dd className="text-sm"><DataList value={v} /></dd>
        </div>
      ))}
    </dl>
  );
};

const Field = ({ label, value }: { label: string; value?: string }) => (
  <div className="grid gap-1 sm:grid-cols-[200px_1fr] border-b border-border pb-2 last:border-0">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-sm font-medium">{value ?? <span className="font-normal text-muted-foreground">Não informado pelo Master</span>}</dd>
  </div>
);

const STATUS_VARIANT: Record<SubscriptionStatus, BadgeProps["variant"]> = {
  active: "default", pending: "pending", overdue: "destructive", suspended: "destructive", cancelled: "outline", unknown: "outline",
};

const NOT_FOUND_TEXT: Record<string, string> = {
  assinatura: "Nenhuma assinatura foi encontrada para esta instalação no Painel Master.",
  cobranças: "Nenhuma cobrança foi encontrada para esta instalação.",
  "histórico de pagamentos": "Nenhum pagamento foi encontrado para esta instalação.",
};

const serviceMessage = (s: ServiceReply | undefined, what: string) => {
  if (!s) return null;
  const detail = s.message ?? `HTTP ${s.http_status}`;
  switch (s.state) {
    case "not_published":
      return { tone: "muted", text: `A consulta de ${what} ainda não foi publicada no Painel Master. Ela aparece aqui automaticamente assim que for publicada.` };
    case "not_found":
      return { tone: "muted", text: NOT_FOUND_TEXT[what] ?? s.message ?? `Nada encontrado em ${what}.` };
    case "auth_failed":
      return { tone: "error", text: `O Painel Master não aceitou as credenciais desta instalação ao consultar ${what}: ${detail}` };
    case "unauthorized_installation":
      return { tone: "error", text: `Esta instalação não está autorizada a consultar ${what} no Painel Master: ${detail}` };
    case "temporary_error":
      return { tone: "warn", text: `Falha temporária de comunicação com o Painel Master ao consultar ${what}. Tente novamente em instantes.` };
    case "error":
      return { tone: "error", text: `Erro inesperado do Painel Master ao consultar ${what}: ${detail}` };
    default:
      return null;
  }
};

const ServiceNote = ({ s, what }: { s?: ServiceReply; what: string }) => {
  const m = serviceMessage(s, what);
  if (!m) return null;
  const cls = m.tone === "error" ? "text-destructive" : m.tone === "warn" ? "text-foreground" : "text-muted-foreground";
  return <p className={`text-sm ${cls}`}>{m.text}</p>;
};

const Pager = ({ list, onPage, disabled }: { list: FinanceList; onPage: (p: number) => void; disabled: boolean }) => {
  const pages = Math.max(1, Math.ceil(list.total / Math.max(1, list.perPage)));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <span className="text-xs text-muted-foreground">Página {list.page} de {pages} · {list.total} registros</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={disabled || list.page <= 1} onClick={() => onPage(list.page - 1)}>Anterior</Button>
        <Button size="sm" variant="outline" disabled={disabled || list.page >= pages} onClick={() => onPage(list.page + 1)}>Próxima</Button>
      </div>
    </div>
  );
};

const ReceiptLink = ({ url }: { url: unknown }) =>
  typeof url === "string" && isHttps(url) ? (
    <Button asChild size="sm" variant="outline">
      <a href={url} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4 mr-2" />Comprovante</a>
    </Button>
  ) : null;

const chargeBadge = (status: unknown): BadgeProps["variant"] => {
  const k = chargeKind(status);
  if (k === "paid") return "default";
  if (k === "expired" || k === "rejected" || String(status).toLowerCase() === "overdue") return "destructive";
  if (k === "cancelled" || k === "refunded") return "outline";
  if (k === "pending") return "pending";
  return "secondary";
};

/** Fields from the Master's charge contract: description, amount, due_date, status, payable, paid_at, receipt_url. */
const ChargeList = ({ items, empty, paying, onPay }: { items: Record<string, unknown>[]; empty: string; paying: string | null; onPay: (id: string, url?: unknown) => void }) => {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <Accordion type="single" collapsible className="border-y border-border">
      {items.map((c, i) => {
        const id = typeof c.id === "string" ? c.id : null;
        const status = financeStatusLabel(c.status);
        const notice = chargeNotice(c);
        const reference = chargeReference(c);
        return (
          <AccordionItem key={id ?? i} value={`${id ?? "charge"}-${i}`} className="last:border-b-0">
            <AccordionTrigger className="gap-3 px-2 text-left hover:no-underline hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
              <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_120px_100px]">
                <span className="min-w-0 break-words text-sm">
                  <span className="block font-medium">{typeof c.description === "string" ? c.description : "Cobrança"}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{reference ? `${reference} · ` : ""}Vencimento: {formatDate(c.due_date) ?? "Não informado"}</span>
                </span>
                <span className="text-right text-sm font-semibold sm:col-start-2">{formatMoney(c.amount) ?? "—"}</span>
                {status && <span className="col-span-2 sm:col-span-1 sm:col-start-3 sm:justify-self-end"><Badge variant={chargeBadge(c.status)}>{status}</Badge></span>}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-2 pt-2 space-y-3">
            <dl className="grid gap-2 [&_dd]:min-w-0 [&_dd]:break-words">
              <Field label="Valor" value={formatMoney(c.amount)} />
              <Field label="Vencimento" value={formatDate(c.due_date)} />
              <Field label="Referência" value={reference} />
              <Field label="Situação" value={status} />
              {c.paid_at ? <Field label="Pago em" value={formatDate(c.paid_at)} /> : null}
              <Field label="ID da cobrança" value={id ?? undefined} />
            </dl>
            {notice && (
              <p className={`text-sm flex items-center gap-2 ${notice.tone === "ok" ? "text-primary font-medium" : notice.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {notice.tone === "ok" && <CheckCircle2 className="h-4 w-4" />}{notice.text}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {canPayCharge(c) && id && (
                <Button size="sm" variant="pay" onClick={() => onPay(id, (c as any).checkout_url)} disabled={paying !== null}>
                  {paying === id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                  {chargeKind(c.status) === "rejected" ? "Tentar pagar novamente" : "Pagar com Mercado Pago"}
                </Button>
              )}
              <ReceiptLink url={c.receipt_url} />
            </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

const PAYMENT_FIELDS = new Set([
  "id", "charge_id", "paid_at", "amount", "currency", "method", "method_label", "status", "description", "reference", "receipt_url", "transaction_id",
]);

/** Payments exactly as the Master's /payments contract sends them. */
const PaymentList = ({ list }: { list: FinanceList }) => {
  const items = dedupeById(list.items);
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nenhum pagamento registrado até o momento.</p>;
  return (
    <Accordion type="single" collapsible className="border-y border-border">
      {items.map((p, i) => {
        const txt = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : String(v));
        const extra = Object.fromEntries(Object.entries(p).filter(([k]) => !PAYMENT_FIELDS.has(k)));
        const status = financeStatusLabel(p.status);
        return (
          <AccordionItem key={typeof p.id === "string" ? p.id : i} value={`${txt(p.id) ?? "payment"}-${i}`} className="last:border-b-0">
            <AccordionTrigger className="gap-3 px-2 text-left hover:no-underline hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
              <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_120px_100px]">
                <span className="min-w-0 break-words text-sm">
                  <span className="block font-medium">{txt(p.reference) ?? txt(p.description) ?? "Pagamento"}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{formatDate(p.paid_at) ?? "Data não informada"}{(txt(p.method_label) ?? txt(p.method)) ? ` · ${txt(p.method_label) ?? txt(p.method)}` : ""}</span>
                </span>
                <span className="text-right text-sm font-semibold sm:col-start-2">{formatMoney(p.amount) ?? "—"}</span>
                {status && <span className="col-span-2 sm:col-span-1 sm:col-start-3 sm:justify-self-end"><Badge variant={chargeBadge(p.status)}>{status}</Badge></span>}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-2 pt-2 space-y-3">
            <dl className="grid gap-2 [&_dd]:min-w-0 [&_dd]:break-words">
              <Field label="Descrição" value={txt(p.description)} />
              <Field label="Valor" value={formatMoney(p.amount)} />
              <Field label="Método" value={txt(p.method_label) ?? txt(p.method)} />
              <Field label="Data e horário" value={formatDate(p.paid_at)} />
              <Field label="Referência" value={txt(p.reference)} />
              <Field label="Situação" value={status} />
              <Field label="ID da transação" value={txt(p.transaction_id)} />
              <Field label="ID da cobrança" value={txt(p.charge_id)} />
              <Field label="ID do pagamento" value={txt(p.id)} />
            </dl>
            <ReceiptLink url={p.receipt_url} />
            {Object.keys(extra).length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Outras informações enviadas pelo Master</summary>
                <div className="mt-2"><DataList value={extra} /></div>
              </details>
            )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

const StaleNote = () => (
  <p className="text-xs text-muted-foreground">Falha temporária ao atualizar. Mostrando os últimos registros recebidos do Painel Master.</p>
);

interface Props { onBackToMain: () => void }

export const MySubscription = ({ onBackToMain }: Props) => {
  const [data, setData] = useState<SubscriptionReply | null>(() => {
    try { const c = localStorage.getItem(CACHE_KEY); return c ? JSON.parse(c) : null; } catch { return null; }
  });
  const [fromCache, setFromCache] = useState<boolean>(() => !!data);
  // Services whose last refresh failed temporarily; their previous records stay on screen.
  const [stale, setStale] = useState<{ billing: boolean; history: boolean }>({ billing: false, history: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastRun = useRef(0);
  const inFlight = useRef(false);
  const [chargesPage, setChargesPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paying, setPaying] = useState<string | null>(null);
  const [checkoutLink, setCheckoutLink] = useState<{ chargeId: string; url: string } | null>(null);
  // Charge whose checkout was opened: checked every 30 s until the Master confirms or the window ends.
  const [watching, setWatching] = useState<{ chargeId: string; until: number } | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastRun.current = Date.now();
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.functions.invoke("pdv-subscription", {
      body: { action: "subscription", charges_page: chargesPage, payments_page: paymentsPage },
    });
    if (err) {
      let msg = "Falha temporária de comunicação. Os últimos dados válidos continuam na tela.";
      const ctx = (err as any).context as Response | undefined;
      try { const p = await ctx?.json(); if (p?.error) msg = p.error; } catch { /* keep default */ }
      setError(msg);
    } else {
      const next = res as SubscriptionReply;
      // Keep the last valid data when the Master is temporarily unreachable.
      const transient = next.configured && next.verify?.state === "temporary_error";
      if (transient) {
        setError("Falha temporária de comunicação com o Painel Master. Os últimos dados válidos continuam na tela.");
      } else {
        setData((prev) => {
          const billing = keepLastValid(prev?.billing, next.billing);
          const history = keepLastValid(prev?.history, next.history);
          setStale({ billing: billing.stale, history: history.stale });
          const merged: SubscriptionReply = { ...next, billing: billing.reply, history: history.reply };
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
          return merged;
        });
        setFromCache(false);
      }
    }
    setLoading(false);
    inFlight.current = false;
  }, [chargesPage, paymentsPage]);

  // The Master creates the checkout; the PDV only opens the link it returns and never marks anything as paid.
  const pay = useCallback(async (chargeId: string, existingUrl?: unknown) => {
    // The charge already carries the Master's official link: open it right in the click (no wait, no new checkout).
    if (isOfficialCheckout(existingUrl)) {
      setCheckoutLink({ chargeId, url: existingUrl });
      setWatching({ chargeId, until: Date.now() + WATCH_WINDOW_MS });
      const w = window.open(existingUrl, "_blank", "noopener,noreferrer");
      toast(w === null
        ? { title: "Link de pagamento pronto", description: "Se a nova aba não abriu, use o botão \"Abrir checkout do Mercado Pago\" abaixo da cobrança." }
        : { title: "Checkout aberto", description: "Depois de pagar, esta tela se atualiza sozinha quando o Painel Master confirmar o recebimento." });
      return;
    }
    setPaying(chargeId);
    setCheckoutLink(null);
    // Opened inside the click so the browser does not block it; navigated when the link arrives.
    const win = prepareTab();
    let res: any = null;
    let err: unknown = null;
    try {
      const r = await supabase.functions.invoke("pdv-subscription", { body: { action: "checkout", charge_id: chargeId } });
      res = r.data; err = r.error;
    } catch (e) { err = e; }
    setPaying(null);
    const url = !err && res?.ok && isOfficialCheckout(res.checkout_url) ? res.checkout_url as string : null;
    if (!err && res?.ok && !url) {
      try { win?.close(); } catch { /* ignore */ }
      toast({ variant: "destructive", title: "Link de pagamento inválido", description: res?.checkout_url ? "O link recebido não é do Mercado Pago e não foi aberto." : "O Painel Master não devolveu o link de pagamento desta cobrança." });
      return;
    }
    if (url) {
      // Always keep the official link on screen, in case the browser refused the new tab.
      setCheckoutLink({ chargeId, url });
      setWatching({ chargeId, until: Date.now() + WATCH_WINDOW_MS });
      if (openPreparedTab(win, url)) {
        toast({ title: "Checkout aberto", description: "Depois de pagar, esta tela se atualiza sozinha quando o Painel Master confirmar o recebimento." });
      } else {
        toast({ title: "Link de pagamento pronto", description: "O navegador não abriu a nova aba. Use o botão \"Abrir checkout do Mercado Pago\" abaixo da cobrança." });
      }
      return;
    }
    try { win?.close(); } catch { /* ignore */ }
    let msg = res?.message ?? "Não foi possível abrir o pagamento agora. Tente novamente em instantes.";
    const ctx = (err as any)?.context as Response | undefined;
    try { const p = await ctx?.json(); if (p?.error) msg = p.error; } catch { /* keep default */ }
    toast({ variant: "destructive", title: "Pagamento não iniciado", description: msg });
  }, [toast]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, AUTO_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun.current > FOCUS_MIN_GAP_MS) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  // Charges as the Master last reported them.
  const charges = useMemo(() => (data?.billing?.state === "ok" ? readList(data.billing.data).items : null), [data]);

  // When the Master no longer offers a charge for payment (paid, cancelled…), drop its
  // checkout link and stop the extra checks; confirm visually when it was paid.
  useEffect(() => {
    if (!charges) return;
    const ids = [checkoutLink?.chargeId, watching?.chargeId].filter((v): v is string => !!v);
    for (const cid of new Set(ids)) {
      const c = charges.find((x) => x.id === cid);
      if (c && canPayCharge(c)) continue;
      if (c && chargeKind(c.status) === "paid" && watching?.chargeId === cid) {
        toast({ title: "Pagamento confirmado", description: `${typeof c.description === "string" ? c.description : "Cobrança"} foi confirmada pelo Painel Master.` });
      }
      if (checkoutLink?.chargeId === cid) setCheckoutLink(null);
      if (watching?.chargeId === cid) setWatching(null);
    }
  }, [charges, checkoutLink, watching, toast]);

  useEffect(() => {
    if (!watching) return;
    const timer = window.setInterval(() => {
      if (Date.now() > watching.until) { setWatching(null); return; }
      if (document.visibilityState === "visible") void load();
    }, WATCH_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [watching, load]);

  const sub = data?.subscription;
  const view = sub?.state === "ok" ? readSubscription(sub.data) : null;
  const status = view ? normalizeStatus(view.status) : null;
  const id = data?.identity;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBackToMain} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold flex items-center gap-2"><CreditCard className="h-5 w-5" />Minha Assinatura</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Atualizar
          </Button>
        </div>

        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Plano, valores, vencimentos e pagamentos são definidos somente pelo Painel Master Pedla. Este PDV apenas mostra as informações recebidas.
          </AlertDescription>
        </Alert>

        {loading && !data && (
          <Card><CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Carregando assinatura…
          </CardContent></Card>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erro temporário de comunicação</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>Tentar novamente</Button>
            </AlertDescription>
          </Alert>
        )}

        {data?.checked_at && (
          <p className="text-xs text-muted-foreground">
            {fromCache ? "Últimos dados válidos, de " : "Atualizado em "}{formatDate(data.checked_at)}
          </p>
        )}

        {data && !data.configured && (
          <Alert>
            <AlertTitle>Integração não configurada</AlertTitle>
            <AlertDescription>A assinatura aparece aqui depois que a instalação for conectada ao Painel Master.</AlertDescription>
          </Alert>
        )}

        {data?.refused && (
          <Alert variant="destructive"><AlertTitle>Resposta recusada</AlertTitle><AlertDescription>{data.refused}</AlertDescription></Alert>
        )}

        {data?.configured && !data.refused && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2"><Store className="h-5 w-5" />Loja identificada</CardTitle>
                  <Badge variant={id ? "default" : "destructive"}>{id ? "Confirmada pelo Painel Master" : "Não confirmada"}</Badge>
                </div>
                <CardDescription>Identificação feita pelo Master a partir das credenciais desta instalação.</CardDescription>
              </CardHeader>
              <CardContent>
                {id ? (
                  <dl className="grid gap-2">
                    <Field label="Loja" value={id.store_name ?? undefined} />
                    <Field label="ID da loja no Master" value={id.store_id ?? undefined} />
                    <Field label="Instalação" value={[id.installation_name, id.installation_id].filter(Boolean).join(" · ")} />
                    <Field label="Licença" value={id.license_status ? (id.license_active ? `Ativa (${id.license_status})` : id.license_status) : undefined} />
                    <Field label="Licença válida de" value={formatDate(id.license_valid_from)} />
                    <Field label="Licença válida até" value={formatDate(id.license_valid_until)} />
                    {id.license_message ? <Field label="Mensagem" value={id.license_message} /> : null}
                  </dl>
                ) : (
                  <p className="text-sm text-destructive">
                    {data.verify?.message ?? "O Painel Master não confirmou esta instalação."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg">Dados da assinatura</CardTitle>
                  {status ? (
                    <Badge variant={STATUS_VARIANT[status]}>{status === "unknown" && view?.status ? String(view.status) : STATUS_LABEL[status]}</Badge>
                  ) : sub?.state === "not_published" ? (
                    <Badge variant="outline">Não publicado no Master</Badge>
                  ) : sub?.state === "not_found" ? (
                    <Badge variant="outline">Sem assinatura</Badge>
                  ) : sub?.state === "temporary_error" ? (
                    <Badge variant="secondary">Erro temporário</Badge>
                  ) : sub ? <Badge variant="destructive">Serviço indisponível</Badge> : null}
                </div>
                <CardDescription>Plano, valor contratado, periodicidade, contratação, vencimento e situação.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {view ? (
                  <>
                    <dl className="grid gap-2">
                      <Field label="Plano" value={view.plan === undefined ? undefined : String(view.plan)} />
                      <Field label="Valor contratado" value={formatMoney(view.amount)} />
                      <Field label="Periodicidade" value={formatPeriod(view.periodicity)} />
                      <Field label="Data da contratação" value={formatDate(view.contractedAt)} />
                      <Field label="Próximo vencimento" value={formatDate(view.nextDue)} />
                      <Field label="Situação" value={status ? (status === "unknown" ? String(view.status ?? "") || undefined : STATUS_LABEL[status]) : undefined} />
                      <Field label="Pago até" value={formatDate(view.paidUntil)} />
                      <Field
                        label="Último pagamento confirmado"
                        value={view.lastPaymentAt === undefined ? undefined : [
                          formatDate(view.lastPaymentAt),
                          formatMoney(view.lastPaymentAmount),
                          view.lastPaymentMethod === undefined ? undefined : String(view.lastPaymentMethod),
                        ].filter(Boolean).join(" · ")}
                      />
                      {view.lastPaymentTransactionId !== undefined && (
                        <Field label="ID da transação do último pagamento" value={String(view.lastPaymentTransactionId)} />
                      )}
                      <Field label="Valor pago até o momento" value={formatMoney(view.totalPaid)} />
                    </dl>
                    {Object.keys(view.rest).length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Outras informações enviadas pelo Master</summary>
                        <div className="mt-2"><DataList value={view.rest} /></div>
                      </details>
                    )}
                  </>
                ) : (
                  <ServiceNote s={sub} what="assinatura" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Receipt className="h-5 w-5" />Cobranças e pagamentos</CardTitle>
                <CardDescription>Cobranças em aberto, histórico de cobranças encerradas e pagamentos confirmados pelo Painel Master.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {data.billing?.state === "ok" ? (() => {
                  const list = readList(data.billing.data);
                  const { current, closed } = splitCharges(list.items);
                  return (<>
                    {stale.billing && <StaleNote />}
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" />Cobranças atuais</h3>
                      <ChargeList items={current} empty="Nenhuma cobrança em aberto no momento." paying={paying} onPay={(cid, u) => void pay(cid, u)} />
                      {checkoutLink && current.some((c) => c.id === checkoutLink.chargeId && canPayCharge(c)) && (
                        <Alert>
                          <ExternalLink className="h-4 w-4" />
                          <AlertTitle>Checkout do Mercado Pago pronto</AlertTitle>
                          <AlertDescription className="space-y-2">
                            <p>Se a página de pagamento não abriu, use o botão abaixo. Ele abre o link oficial desta cobrança enviado pelo Painel Master.</p>
                            <Button asChild size="sm" variant="pay">
                              <a href={checkoutLink.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" />Abrir checkout do Mercado Pago
                              </a>
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                    </section>
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><History className="h-4 w-4" />Histórico de cobranças</h3>
                      <ChargeList items={closed} empty="Nenhuma cobrança encerrada até o momento." paying={paying} onPay={(cid, u) => void pay(cid, u)} />
                    </section>
                    <Pager list={list} onPage={setChargesPage} disabled={loading} />
                  </>);
                })() : (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" />Cobranças atuais e histórico de cobranças</h3>
                    <ServiceNote s={data.billing} what="cobranças" />
                  </section>
                )}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Histórico de pagamentos</h3>
                  {data.history?.state === "ok" ? (() => {
                    const list = readList(data.history.data);
                    return (<>
                      {stale.history && <StaleNote />}
                      <PaymentList list={list} />
                      <Pager list={list} onPage={setPaymentsPage} disabled={loading} />
                    </>);
                  })() : <ServiceNote s={data.history} what="histórico de pagamentos" />}
                </section>
                <p className="text-xs text-muted-foreground">
                  Um pagamento só aparece como pago depois que o Painel Master confirmar o recebimento. Voltar do checkout não confirma o pagamento.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
