import { supabase } from "@/integrations/supabase/client";
import { separateLineItems } from "@/lib/separateLineItems";

interface PrintItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  note?: string;
}

interface PrintSaleInput {
  customerName?: string;
  sellerName?: string;
  items: PrintItem[];
  total: number;
  paymentMethod?: string;
  amountReceived?: number;
  date?: Date;
  orderNumber?: string;
  notes?: string;
}

const escapeHtml = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function printSaleReceipt(input: PrintSaleInput) {
  // Open the print window before loading settings, while the click still allows it.
  const printWindow = window.open("", "", "width=800,height=600");
  if (!printWindow) return;
  const { data: settings } = await supabase
    .from("store_settings")
    .select(
      "store_name, logo_url, address, phone, printer_width, printer_font_size, printer_show_logo, printer_show_address, printer_show_phone, printer_show_seller, printer_show_customer, printer_show_order_number, printer_show_payment_method, printer_show_date, printer_header_text, printer_footer_text, printer_margin_left"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const s: any = { ...(settings || {}) };
  const marker = "/storage/v1/object/public/";
  if (s.logo_url && s.logo_url.includes(marker)) {
    const rest = decodeURIComponent(s.logo_url.split(marker)[1].split("?")[0]);
    const i = rest.indexOf("/");
    const { data: signed } = await supabase.storage.from(rest.slice(0, i)).createSignedUrl(rest.slice(i + 1), 3600);
    if (signed?.signedUrl) s.logo_url = signed.signedUrl;
  }
  const width: string = s.printer_width || "58mm";
  const fontSize: number = s.printer_font_size || 10;
  const headerFontSize = fontSize + 2;
  const marginLeftMm = Math.max(0, Number(s.printer_margin_left) || 0);
  const date = input.date || new Date();

  const showLogo = s.printer_show_logo !== false;
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

  const itemsHtml = separateLineItems(input.items)
    .map(
      (it) => `
      <tr style="border-bottom:${it.note ? "none" : "1px solid #ccc"};">
        <td style="padding:2px 0;">${escapeHtml(it.name)}</td>
        <td style="text-align:center;padding:2px 0;">${it.quantity}</td>
        <td style="text-align:right;padding:2px 0;">R$ ${it.total.toFixed(2)}</td>
      </tr>${
        it.note
          ? `<tr style="border-bottom:1px solid #ccc;"><td colspan="3" style="padding:0 0 2px 4px;font-style:italic;">Obs.: ${escapeHtml(it.note.replace(/^Obs:\s*/gim, "")).replace(/\n/g, "<br/>")}</td></tr>`
          : ""
      }`
    )
    .join("");


  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Comanda</title>
    <style>
      @page { size: ${width} auto; margin: 0 0 0 ${marginLeftMm}mm; }
      body { margin:0; font-family: Arial, sans-serif; color:#000; background:#fff; font-size:${fontSize}px; }
      .wrap { width:${width}; margin-left:${marginLeftMm}mm; padding:4px; box-sizing:border-box; }
      .center { text-align:center; }
      .bold { font-weight:bold; }
      .row { display:flex; justify-content:space-between; }
      .sep-b { border-bottom:1px solid #000; padding-bottom:4px; margin-bottom:4px; }
      .sep-b-light { border-bottom:1px solid #999; padding-bottom:4px; margin-bottom:4px; }
      table { width:100%; border-collapse:collapse; font-size:${fontSize}px; }
      th { border-bottom:1px solid #000; text-align:left; padding:2px 0; }
      th.qtd { text-align:center; width:32px; }
      th.tot { text-align:right; width:60px; }
      .hdr { font-size:${headerFontSize}px; }
      img.logo { max-width: calc(${width} - 6mm); height:7.5em; width:auto; object-fit:contain; display:block; margin:0 auto 4px; }
    </style></head><body>
    <div class="wrap">
      <div class="center sep-b hdr">
        ${showLogo && s.logo_url ? `<img class="logo" src="${escapeHtml(s.logo_url)}" alt="Logo"/>` : ""}
        ${headerText ? `<p style="font-size:${fontSize}px;margin:0;">${escapeHtml(headerText)}</p>` : ""}
        <h1 class="bold hdr" style="margin:2px 0;">${escapeHtml(storeName)}</h1>
        ${showAddress && s.address ? `<p style="margin:0;">${escapeHtml(s.address)}</p>` : ""}
        ${showPhone && s.phone ? `<p style="margin:0;">Tel: ${escapeHtml(s.phone)}</p>` : ""}
      </div>
      <div class="center sep-b-light">
        ${showOrderNumber && input.orderNumber ? `<p class="bold" style="margin:0;">Pedido: #${escapeHtml(input.orderNumber)}</p>` : ""}
        ${showDate ? `<p style="margin:0;">${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>` : ""}
      </div>
      <div style="margin-bottom:4px;">
        ${showCustomer ? `<div class="row"><span class="bold">Cliente:</span><span>${escapeHtml(input.customerName || "Cliente sem nome")}</span></div>` : ""}
        ${showSeller && input.sellerName ? `<div class="row"><span class="bold">Vendedor:</span><span>${escapeHtml(input.sellerName)}</span></div>` : ""}
      </div>
      <table>
        <thead><tr><th>Produto</th><th class="qtd">Qtd</th><th class="tot">Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="border-top:1px solid #000;padding-top:4px;margin-top:4px;">
        <div class="row bold" style="font-size:${headerFontSize}px;"><span>TOTAL:</span><span>R$ ${input.total.toFixed(2)}</span></div>
        ${showPaymentMethod && input.paymentMethod ? `<div class="row" style="margin-top:2px;"><span class="bold">Pagamento:</span><span>${escapeHtml(input.paymentMethod)}</span></div>` : ""}
        ${showPaymentMethod && input.paymentMethod?.toLowerCase().includes("dinheiro") && input.amountReceived !== undefined ? `
        <div class="row" style="margin-top:2px;"><span>Recebido:</span><span>R$ ${input.amountReceived.toFixed(2)}</span></div>
        <div class="row bold" style="margin-top:2px;"><span>TROCO:</span><span>R$ ${(input.amountReceived - input.total).toFixed(2)}</span></div>` : ""}
      </div>
      ${input.notes ? `<div style="border-top:1px solid #999;padding-top:4px;margin-top:4px;"><span class="bold">Obs.:</span> ${escapeHtml(input.notes).replace(/\n/g, "<br/>")}</div>` : ""}
      ${footerText ? `<div class="center" style="border-top:1px solid #999;padding-top:4px;margin-top:4px;">${escapeHtml(footerText)}</div>` : ""}
    </div>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };</script>
    </body></html>`;

  if (printWindow.closed) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}
