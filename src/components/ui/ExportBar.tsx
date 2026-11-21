import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, FileSpreadsheet, Search, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export function exportRowsPDF<T>(title: string, columns: ExportColumn<T>[], rows: T[], subtitle?: string) {
  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`${subtitle ? subtitle + "  |  " : ""}Gerado em ${new Date().toLocaleString("pt-BR")}  |  ${rows.length} registro(s)`, 14, 23);
  autoTable(doc, {
    startY: 28,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(c.value(r) ?? "-"))),
    styles: { fontSize: 8 },
  });
  doc.save(`${slug(title)}-${stamp()}.pdf`);
}

export function exportRowsExcel<T>(title: string, columns: ExportColumn<T>[], rows: T[]) {
  const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c.header, c.value(r) ?? ""])));
  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.header) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${slug(title)}-${stamp()}.xlsx`);
}

const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const stamp = () => new Date().toISOString().slice(0, 10);

interface Options<T> {
  title: string;
  columns: ExportColumn<T>[];
  /** campo de data usado no filtro de período (opcional) */
  getDate?: (row: T) => string | null | undefined;
  subtitle?: string;
  extra?: ReactNode;
}

/** Filtro personalizado (busca + período) e exportação PDF/Excel das linhas filtradas. */
export function useExportFilter<T>(rows: T[], opts: Options<T>) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !opts.columns.some((c) => String(c.value(r) ?? "").toLowerCase().includes(q))) return false;
      if (opts.getDate && (from || to)) {
        const d = (opts.getDate(r) || "").slice(0, 10);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, from, to]);

  const period = from || to ? `Período: ${from || "..."} a ${to || "..."}` : undefined;
  const sub = [opts.subtitle, period, search ? `Busca: "${search}"` : undefined].filter(Boolean).join("  |  ");

  const bar = (
    <Card>
      <CardContent className="pt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por qualquer informação..." />
          </div>
        </div>
        {opts.getDate && (
          <>
            <div>
              <Label>De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}
        {opts.extra}
        {(search || from || to) && (
          <Button variant="ghost" onClick={() => { setSearch(""); setFrom(""); setTo(""); }}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
        <Button variant="outline" onClick={() => exportRowsPDF(opts.title, opts.columns, filtered, sub)}>
          <FileText className="h-4 w-4 mr-1" /> PDF
        </Button>
        <Button variant="outline" onClick={() => exportRowsExcel(opts.title, opts.columns, filtered)}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
        </Button>
        <span className="text-xs text-muted-foreground w-full">{filtered.length} de {rows.length} registro(s)</span>
      </CardContent>
    </Card>
  );

  return { filtered, bar };
}
