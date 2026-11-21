import { prepareTab, openPreparedTab } from "@/lib/checkoutWindow";
import { supabase } from "@/integrations/supabase/client";
import { separateLineItems } from "@/lib/separateLineItems";

interface ShareItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  note?: string;
}

interface ShareSaleInput {
  customerName?: string;
  sellerName?: string;
  items: ShareItem[];
  total: number;
  paymentMethod?: string;
  date?: Date;
  orderNumber?: string;
  notes?: string;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

async function fetchReceiptSettings() {
  const { data } = await supabase
    .from("store_settings")
    .select(
      "store_name, address, phone, printer_show_address, printer_show_phone, printer_show_seller, printer_show_customer, printer_show_order_number, printer_show_payment_method, printer_show_date, printer_header_text, printer_footer_text"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data || {}) as any;
}

export async function buildSaleReceiptText(input: ShareSaleInput) {
  const s = await fetchReceiptSettings();

  const showAddress = s.printer_show_address !== false;
  const showPhone = s.printer_show_phone !== false;
  const showSeller = s.printer_show_seller !== false;
  const showCustomer = s.printer_show_customer !== false;
  const showOrderNumber = s.printer_show_order_number !== false;
  const showPaymentMethod = s.printer_show_payment_method !== false;
  const showDate = s.printer_show_date !== false;
  const headerText: string = s.printer_header_text || "";
  const footerText: string = s.printer_footer_text || "Obrigado pela preferência!";
  const storeName: string = s.store_name || "COMANDA DE VENDA";

  const date = input.date || new Date();
  const dateStr = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const sep = "------------------------------";
  const lines: string[] = [];

  // Cabeçalho
  if (headerText) lines.push(headerText);
  lines.push(`*${storeName}*`);
  if (showAddress && s.address) lines.push(s.address);
  if (showPhone && s.phone) lines.push(`Tel: ${s.phone}`);
  lines.push(sep);

  // Pedido / data
  if (showOrderNumber && input.orderNumber) lines.push(`*Pedido: #${input.orderNumber}*`);
  if (showDate) lines.push(dateStr);
  lines.push(sep);

  // Cliente / vendedor
  if (showCustomer) lines.push(`Cliente: ${input.customerName || "Cliente sem nome"}`);
  if (showSeller && input.sellerName) lines.push(`Vendedor: ${input.sellerName}`);
  if (showCustomer || (showSeller && input.sellerName)) lines.push(sep);

  // Itens
  lines.push("*Itens:*");
  for (const it of separateLineItems(input.items)) {
    lines.push(
      `${it.quantity}x ${it.name}  ${formatBRL(it.unit_price)} = ${formatBRL(it.total_price)}`
    );
    if (it.note && it.note.trim()) {
      it.note.split("\n").map((s) => s.trim()).filter(Boolean).forEach((l) => lines.push(`   Obs.: ${l}`));
    }
  }
  lines.push(sep);

  // Total / pagamento
  lines.push(`*TOTAL: ${formatBRL(input.total)}*`);
  if (showPaymentMethod && input.paymentMethod) lines.push(`Pagamento: ${input.paymentMethod}`);

  // Observações gerais
  if (input.notes && input.notes.trim()) {
    lines.push(sep);
    lines.push("*Observações:*");
    lines.push(input.notes.trim());
  }

  // Rodapé
  if (footerText) {
    lines.push(sep);
    lines.push(footerText);
  }

  return lines.join("\n");
}

export async function shareSaleWhatsApp(input: ShareSaleInput) {
  // Open the tab during the click; the text is loaded afterwards, when the browser
  // would no longer allow a new tab.
  const win = prepareTab("Abrindo o WhatsApp…");
  try {
    const text = await buildSaleReceiptText(input);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (!openPreparedTab(win, url)) window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    try { win?.close(); } catch { /* ignore */ }
    throw e;
  }
}

export async function shareSaleEmail(input: ShareSaleInput) {
  const s = await fetchReceiptSettings();
  const storeName: string = s.store_name || "Comanda";
  const subject = `${storeName} - Pedido ${input.orderNumber ? `#${input.orderNumber}` : ""}`.trim();
  const body = (await buildSaleReceiptText(input)).replace(/\*/g, "");
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}
