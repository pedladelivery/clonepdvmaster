import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Eye, FileText, Download, Filter, X, Calendar, Share2, Mail, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BackToMainButton } from "@/components/ui/BackToMainButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { printSaleReceipt } from "@/lib/printSaleReceipt";
import { shareSaleEmail, shareSaleWhatsApp } from "@/lib/shareSale";
import { separateLineItems } from "@/lib/separateLineItems";
import { useStore } from "@/contexts/StoreContext";
import { StoreFilterSelect } from "@/components/StoreFilterSelect";
import { fetchSellerIdsForStore } from "@/lib/sellerStores";
import { adjustStoreStock } from "@/lib/stock";
import { usePdvControls } from "@/contexts/PdvControlsContext";

interface SaleItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string | null;
  products?: {
    name: string;
  };
}

interface Sale {
  id: string;
  user_id?: string;
  total: number;
  status?: string;
  payment_method?: string | null;
  customer_name?: string;
  created_at: string;
  sale_number?: number;
  notes?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  seller_id?: string | null;
  sellers?: { name: string } | null;
  sale_items: SaleItem[];
}

interface SalesHistoryProps {
  onBackToMain: () => void;
}

export const SalesHistory = ({ onBackToMain }: SalesHistoryProps) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [sellerFilter, setSellerFilter] = useState<string>("todos");
  const [sellerOptions, setSellerOptions] = useState<{ id: string; name: string }[]>([]);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();
  const { scopeStoreId, writeStoreId, isSuperAdmin, stores } = useStore();
  const { isBlocked: isControlBlocked, messageFor: controlMessage } = usePdvControls();

  const handleCancelSale = async () => {
    if (!saleToCancel) return;
    if (!cancelReason.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Descreva o motivo do cancelamento da venda.",
        variant: "destructive",
      });
      return;
    }

    if (isControlBlocked("sales") || isControlBlocked("admin")) {
      toast({
        title: "Operação bloqueada",
        description: controlMessage(isControlBlocked("sales") ? "sales" : "admin"),
        variant: "destructive",
      });
      return;
    }

    setCancelling(true);
    try {
      const saleLabel = `#${String(saleToCancel.sale_number ?? 0).padStart(2, "0")}`;

      // Itens originais (sem separação de linhas) para devolver ao estoque
      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("product_id, quantity")
        .eq("sale_id", saleToCancel.id);
      if (itemsError) throw itemsError;

      const quantities = new Map<string, number>();
      (items || []).forEach((it) => {
        quantities.set(it.product_id, (quantities.get(it.product_id) || 0) + Number(it.quantity));
      });

      const saleStoreId = (saleToCancel as any).store_id ?? writeStoreId!;

      // Cancel first so a Master lock refuses before any stock is touched
      const { data: userData } = await supabase.auth.getUser();
      const { error: saleError } = await supabase
        .from("sales")
        .update({
          status: "cancelled",
          cancel_reason: cancelReason.trim(),
          cancelled_at: new Date().toISOString(),
          cancelled_by: userData?.user?.id ?? null,
        })
        .eq("id", saleToCancel.id);
      if (saleError) throw saleError;

      if (quantities.size > 0) {
        for (const [productId, qty] of quantities.entries()) {
          if (qty <= 0) continue;

          // Devolve ao estoque apenas da loja em que a venda foi feita
          await adjustStoreStock(saleStoreId, productId, qty);

          const { error: movementError } = await supabase.from("stock_movements").insert([
            {
              product_id: productId,
              type: "in",
              quantity: qty,
              reason: `Cancelamento da venda ${saleLabel}: ${cancelReason.trim()}`,
              store_id: saleStoreId,
            },
          ]);
          if (movementError) throw movementError;
        }
      }


      toast({
        title: "Venda cancelada",
        description: `A venda ${saleLabel} foi cancelada e os itens retornaram ao estoque.`,
      });
      setSaleToCancel(null);
      setCancelReason("");
      fetchSales();
    } catch (error) {
      console.error("Error cancelling sale:", error);
      toast({
        title: "Erro",
        description: "Não foi possível cancelar a venda",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [startDate, endDate, statusFilter, scopeStoreId, sellerFilter]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sellers")
        .select("id, name")
        .eq("active", true)
        .order("name");
      let list = (data || []) as { id: string; name: string }[];
      if (scopeStoreId) {
        const ids = new Set(await fetchSellerIdsForStore(scopeStoreId));
        list = list.filter((s) => ids.has(s.id));
      }
      setSellerOptions(list);
      if (sellerFilter !== "todos" && sellerFilter !== "none" && !list.some((s) => s.id === sellerFilter)) {
        setSellerFilter("todos");
      }
    })();
  }, [scopeStoreId]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const startDateTime = startOfDay(startDate).toISOString();
      const endDateTime = endOfDay(endDate).toISOString();

      let query = supabase
        .from("sales")
        .select(`
          *,
          sale_items (
            *,
            products (name)
          ),
          sellers (name)
        `)
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime)
        .order("created_at", { ascending: false });

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      } else {
        query = query.in("status", ["completed", "cancelled"]);
      }

      if (scopeStoreId) {
        query = query.eq("store_id", scopeStoreId);
      }

      if (sellerFilter === "none") {
        query = query.is("seller_id", null);
      } else if (sellerFilter !== "todos") {
        query = query.eq("seller_id", sellerFilter);
      }


      const { data, error } = await query;

      if (error) throw error;
      setSales(
        (data || []).map((sale) => ({
          ...sale,
          sale_items: separateLineItems(sale.sale_items || []),
        }))
      );
    } catch (error) {
      console.error("Error fetching sales:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico de vendas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter(sale =>
    sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validSales = useMemo(
    () => filteredSales.filter((sale) => sale.status !== "cancelled"),
    [filteredSales]
  );

  const totalFilteredSales = useMemo(() => {
    return validSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  }, [validSales]);

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setDialogOpen(true);
  };

  const storeName = (id?: string | null) =>
    stores.find((st) => st.id === id)?.name || "Loja não informada";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const clearFilters = () => {
    setStartDate(new Date());
    setEndDate(new Date());
    setStatusFilter("todos");
    setSellerFilter("todos");
    setSearchTerm("");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Cabeçalho
    doc.setFontSize(18);
    doc.text("Histórico de Vendas", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Exportado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 28);
    doc.text(`Período: ${format(startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`, 14, 34);
    doc.text(`Status: ${statusFilter === "todos" ? "Todos" : statusFilter}`, 14, 40);
    
    // Tabela de vendas
    const tableData = filteredSales.map((sale) => [
      `#${String(sale.sale_number ?? 0).padStart(2, '0')}`,
      sale.customer_name || "Não informado",
      formatCurrency(sale.total),
      format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      sale.status || "completed",
      getPaymentLabel(sale.payment_method) || "Não informada",
      sale.sale_items.length.toString()
    ]);
    
    autoTable(doc, {
      startY: 48,
      head: [["ID", "Cliente", "Valor", "Data", "Status", "Pagamento", "Itens"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [99, 102, 241] }
    });
    
    // Total
    const totalValue = filteredSales
      .filter((sale) => sale.status !== "cancelled")
      .reduce((sum, sale) => sum + Number(sale.total), 0);
    const finalY = (doc as any).lastAutoTable.finalY || 48;
    doc.setFontSize(12);
    doc.text(`Total Geral: ${formatCurrency(totalValue)}`, 14, finalY + 10);
    
    doc.save(`historico-vendas-${format(new Date(), "dd-MM-yyyy")}.pdf`);
    
    toast({
      title: "PDF Exportado",
      description: "O relatório foi baixado com sucesso!",
    });
  };

  const exportToExcel = () => {
    const excelData = filteredSales.map((sale) => ({
      "ID": `#${String(sale.sale_number ?? 0).padStart(2, '0')}`,
      "Cliente": sale.customer_name || "Não informado",
      "Valor": Number(sale.total),
      "Data": format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      "Status": sale.status || "completed",
      "Forma de Pagamento": getPaymentLabel(sale.payment_method) || "Não informada",
      "Quantidade de Itens": sale.sale_items.length
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vendas");
    
    XLSX.writeFile(workbook, `historico-vendas-${format(new Date(), "dd-MM-yyyy")}.xlsx`);
    
    toast({
      title: "Excel Exportado",
      description: "O relatório foi baixado com sucesso!",
    });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      completed: "Concluída",
      pending: "Pendente",
      cancelled: "Cancelada",
      preparing: "Em preparo",
      delivering: "Em entrega"
    };
    return labels[status] || status;
  };

  const getPaymentLabel = (method?: string | null) => {
    if (!method) return null;
    const labels: Record<string, string> = {
      dinheiro: "Dinheiro",
      "cartao-credito": "Cartão de Crédito",
      "cartao-debito": "Cartão de Débito",
      pix: "PIX"
    };
    return labels[method] || method;
  };


  return (
    <div className="p-6 space-y-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Histórico de Vendas</h2>
      </div>

      {/* Área de Filtros */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            Filtros Personalizados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Data Inicial */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data Final */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status da Venda</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>

                </SelectContent>
              </Select>
            </div>

            {/* Vendedor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Vendedor</label>
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os vendedores</SelectItem>
                  {sellerOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                  <SelectItem value="none">Sem vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão Limpar */}
            <div className="space-y-2">
              <label className="text-sm font-medium invisible">Ações</label>
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </div>

          {/* Busca e Exportação */}
          <div className="flex gap-4 items-center flex-wrap">
            <Input
              placeholder="Buscar por cliente ou ID da venda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {filteredSales.length} vendas encontradas
            </Badge>
            <div className="flex gap-2 ml-auto">
              <Button onClick={exportToPDF} variant="default" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
              <Button onClick={exportToExcel} variant="default" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo do Total Filtrado */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-medium">
                Total em vendas do período filtrado
              </p>
              <p className="text-xs text-muted-foreground">
                {validSales.length} venda{validSales.length !== 1 ? "s" : ""} válida{validSales.length !== 1 ? "s" : ""}
                {filteredSales.length - validSales.length > 0 &&
                  ` · ${filteredSales.length - validSales.length} cancelada${filteredSales.length - validSales.length !== 1 ? "s" : ""} (não somada${filteredSales.length - validSales.length !== 1 ? "s" : ""})`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary tracking-tight">
                {formatCurrency(totalFilteredSales)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p>Carregando histórico de vendas...</p>
      ) : (
        <div className="grid gap-4">
          {filteredSales.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">
                  Nenhuma venda registrada hoje.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredSales.map((sale) => (
              <Card
                key={sale.id}
                className={cn(
                  sale.status === "cancelled" && "!bg-red-50 dark:!bg-red-950/20 !border-red-200 dark:!border-red-800"
                )}
              >
                <CardHeader>
                  <div className="flex justify-between items-center">
                  <div className="space-y-1">
                      <CardTitle className="text-lg">
                        Venda #{String(sale.sale_number ?? 0).padStart(2, '0')}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(sale.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(sale.total)}
                        </p>
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Badge variant={sale.status === "cancelled" ? "destructive" : "default"}>
                            {getStatusLabel(sale.status || "completed")}
                          </Badge>
                          {getPaymentLabel(sale.payment_method) && (
                            <Badge variant="outline">
                              {getPaymentLabel(sale.payment_method)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(sale)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Detalhes
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        <strong>Loja:</strong> {storeName((sale as any).store_id)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Vendedor:</strong> {sale.sellers?.name || "Vendedor não informado"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Cliente:</strong> {sale.customer_name || "Cliente não informado"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Itens:</strong> {sale.sale_items.length} produtos
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          printSaleReceipt({
                            customerName: sale.customer_name,
                             sellerName: sale.sellers?.name || undefined,
                            items: sale.sale_items.map((it) => ({
                              name: it.products?.name || "Produto",
                              quantity: it.quantity,
                              price: it.unit_price,
                              total: it.total_price,
                              note: it.notes || undefined,
                            })),
                            total: Number(sale.total),
                            paymentMethod: sale.payment_method || undefined,
                            date: new Date(sale.created_at),
                            orderNumber: String(sale.sale_number ?? 0).padStart(2, "0"),
                            notes: sale.notes || undefined,
                          })
                        }
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Reimprimir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          shareSaleWhatsApp({
                            customerName: sale.customer_name,
                            items: sale.sale_items.map((it) => ({
                              name: it.products?.name || "Produto",
                              quantity: it.quantity,
                              unit_price: it.unit_price,
                              total_price: it.total_price,
                              note: it.notes || undefined,
                            })),
                            total: Number(sale.total),
                            date: new Date(sale.created_at),
                            orderNumber: String(sale.sale_number ?? 0).padStart(2, "0"),
                            notes: sale.notes || undefined,
                          })
                        }
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        WhatsApp
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          shareSaleEmail({
                            customerName: sale.customer_name,
                            items: sale.sale_items.map((it) => ({
                              name: it.products?.name || "Produto",
                              quantity: it.quantity,
                              unit_price: it.unit_price,
                              total_price: it.total_price,
                              note: it.notes || undefined,
                            })),
                            total: Number(sale.total),
                            date: new Date(sale.created_at),
                            orderNumber: String(sale.sale_number ?? 0).padStart(2, "0"),
                            notes: sale.notes || undefined,
                          })
                        }
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Email
                      </Button>
                      {sale.status !== "cancelled" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSaleToCancel(sale);
                            setCancelReason("");
                          }}
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Venda #{String(selectedSale?.sale_number ?? 0).padStart(2, '0')}
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Cliente:</strong> {selectedSale.customer_name || "Cliente não informado"}
                </div>
                <div>
                  <strong>Data:</strong> {formatDate(selectedSale.created_at)}
                </div>
                <div>
                  <strong>Status:</strong>
                  <Badge className="ml-2">{getStatusLabel(selectedSale.status || "completed")}</Badge>
                </div>
                <div>
                  <strong>Total:</strong> {formatCurrency(selectedSale.total)}
                </div>
                <div className="col-span-2">
                  <strong>Loja:</strong> {storeName((selectedSale as any).store_id)}
                </div>
                <div className="col-span-2">
                  <strong>Vendedor:</strong>{" "}
                  {selectedSale.sellers?.name || "Vendedor não informado"}
                </div>
                <div className="col-span-2">
                  <strong>Forma de Pagamento:</strong>{" "}
                  {getPaymentLabel(selectedSale.payment_method) || "Não informada"}
                </div>
              </div>

              {selectedSale.notes && (
                <div className="text-sm">
                  <strong>Observações:</strong>
                  <p className="whitespace-pre-wrap text-muted-foreground">{selectedSale.notes}</p>
                </div>
              )}

              {selectedSale.status === "cancelled" && selectedSale.cancel_reason && (
                <div className="text-sm p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <strong>Motivo do cancelamento:</strong>
                  <p className="whitespace-pre-wrap text-muted-foreground">{selectedSale.cancel_reason}</p>
                  {selectedSale.cancelled_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Cancelada em {formatDate(selectedSale.cancelled_at)}
                    </p>
                  )}
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-3">Itens da Venda</h4>
                <div className="space-y-2">
                  {selectedSale.sale_items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">
                          {item.products?.name || "Produto não encontrado"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Qtd: {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                        {item.notes && (
                          <p className="text-sm italic text-muted-foreground">
                            Obs.: {item.notes}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(item.total_price)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!saleToCancel}
        onOpenChange={(open) => {
          if (!open && !cancelling) {
            setSaleToCancel(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Cancelar Venda #{String(saleToCancel?.sale_number ?? 0).padStart(2, "0")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Descreva o motivo do cancelamento. Os itens da venda voltarão para o estoque.
            </p>
            <Textarea
              placeholder="Motivo do cancelamento..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSaleToCancel(null);
                  setCancelReason("");
                }}
                disabled={cancelling}
              >
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleCancelSale} disabled={cancelling}>
                {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};