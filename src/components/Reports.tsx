import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/dbClient";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { BackToMainButton } from "@/components/ui/BackToMainButton";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useStore } from "@/contexts/StoreContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchStoreCategoryMap } from "@/lib/categoryAccess";

interface ReportsProps {
  onBackToMain: () => void;
}

interface ProductSalesData {
  name: string;
  quantity: number;
  totalValue: number;
}

interface SellerSalesData {
  name: string;
  salesCount: number;
  totalValue: number;
}

export const Reports = ({ onBackToMain }: ReportsProps) => {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [productSalesData, setProductSalesData] = useState<ProductSalesData[]>([]);
  const [sellerData, setSellerData] = useState<SellerSalesData[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalSales, setTotalSales] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [itemsSold, setItemsSold] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { scopeStoreId, isSuperAdmin, stores } = useStore();
  const [reportStore, setReportStore] = useState<string>(scopeStoreId ?? "all");
  const effectiveStoreId = isSuperAdmin ? (reportStore === "all" ? null : reportStore) : scopeStoreId;
  /** "all" = todas, "none" = sem categoria, senão o id da categoria escolhida. */
  const [reportCategory, setReportCategory] = useState<string>("all");
  const [categories, setCategories] = useState<{ id: string; name: string; active: boolean }[]>([]);
  /** Última busca de vendas (loja + período): evita baixar tudo de novo ao trocar só a categoria. */
  const cacheRef = useRef<{ key: string; rows: any[] } | null>(null);

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];

  useEffect(() => {
    // Set default dates to current month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);

    loadReports(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
  }, []);

  const loadReports = async (customStartDate?: string, customEndDate?: string) => {
    setIsLoading(true);
    try {
      const effectiveStartDate = customStartDate ?? startDate;
      const effectiveEndDate = customEndDate ?? endDate;
      const cacheKey = `${effectiveStoreId}|${effectiveStartDate}|${effectiveEndDate}`;

      let sales: any[] | null = null;
      if (cacheRef.current && cacheRef.current.key === cacheKey) {
        // Loja e período iguais aos da última busca: só reaplica o filtro de categoria.
        sales = cacheRef.current.rows;
      } else {
        // Fetch sales data
        let query = supabase
          .from('sales')
          .select(`
            *,
            sellers (name),
            sale_items (
              *,
              products (name, category_id)
            )
          `)
          .eq('status', 'completed');

        if (effectiveStoreId) {
          query = query.eq('store_id', effectiveStoreId);
        }

        if (effectiveStartDate) {
          // Interpreta a data no fuso local (início do dia local), não em UTC
          query = query.gte('created_at', new Date(effectiveStartDate + 'T00:00:00').toISOString());
        }
        if (effectiveEndDate) {
          // Fim do dia local
          query = query.lte('created_at', new Date(effectiveEndDate + 'T23:59:59.999').toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        sales = data ?? [];
        cacheRef.current = { key: cacheKey, rows: sales };
      }


      // Filtro por categoria: com uma categoria escolhida, cada venda passa a
      // contar só os itens daquela categoria (e o valor dela também é recalculado).
      const matchesCategory = (item: any) => {
        const cat = item.products?.category_id ?? null;
        return reportCategory === "none" ? !cat : cat === reportCategory;
      };
      const filteredSales =
        reportCategory === "all"
          ? (sales ?? [])
          : (sales ?? [])
              .filter((sale: any) => (sale.sale_items ?? []).some(matchesCategory))
              .map((sale: any) => {
                const items = (sale.sale_items ?? []).filter(matchesCategory);
                return {
                  ...sale,
                  sale_items: items,
                  total: items.reduce((s: number, it: any) => s + Number(it.total_price || 0), 0),
                };
              });

      // Process sales by date
      const salesByDate = filteredSales.reduce((acc: any, sale: any) => {
        const date = new Date(sale.created_at).toLocaleDateString('pt-BR');
        acc[date] = (acc[date] || 0) + Number(sale.total);
        return acc;
      }, {});

      const salesChartData = Object.entries(salesByDate).map(([date, total]) => ({
        date,
        total: Number(total)
      }));

      // Process products data
      const productSales: any = {};
      const productValues: any = {};
      filteredSales.forEach((sale: any) => {
        sale.sale_items.forEach((item: any) => {
          const productName = item.products?.name || 'Produto';
          productSales[productName] = (productSales[productName] || 0) + item.quantity;
          productValues[productName] = (productValues[productName] || 0) + Number(item.total_price);
        });
      });

      const productsChartData = Object.entries(productSales)
        .map(([name, quantity]) => ({ name, quantity: Number(quantity) }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      const productSalesTableData = Object.entries(productSales)
        .map(([name, quantity]) => ({
          name,
          quantity: Number(quantity),
          totalValue: Number(productValues[name])
        }))
        .sort((a, b) => b.quantity - a.quantity);

      // Process sales by seller
      const sellerSales: any = {};
      filteredSales.forEach((sale: any) => {
        const sellerRelation = sale.sellers;
        const sellerName = (Array.isArray(sellerRelation) ? sellerRelation[0]?.name : sellerRelation?.name) || 'Sem vendedor';
        sellerSales[sellerName] = sellerSales[sellerName] || { salesCount: 0, totalValue: 0 };
        sellerSales[sellerName].salesCount += 1;
        sellerSales[sellerName].totalValue += Number(sale.total);
      });

      const sellerSalesTableData = Object.entries(sellerSales)
        .map(([name, data]) => ({
          name,
          salesCount: Number((data as any).salesCount),
          totalValue: Number((data as any).totalValue)
        }))
        .sort((a, b) => b.totalValue - a.totalValue);

      const itemsSoldTotal = filteredSales.reduce(
        (sum: number, sale: any) => sum + (sale.sale_items?.reduce((s: number, item: any) => s + item.quantity, 0) || 0),
        0
      );

      setSalesData(salesChartData);
      setProductData(productsChartData);
      setProductSalesData(productSalesTableData);
      setSellerData(sellerSalesTableData);
      setTotalSales(filteredSales.reduce((sum: number, sale: any) => sum + Number(sale.total), 0));
      setSalesCount(filteredSales.length);
      setItemsSold(itemsSoldTotal);
      
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar relatórios",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Categorias disponíveis: as da loja selecionada quando houver vínculo, senão todas.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data }, storeMap] = await Promise.all([
          supabase
            .from("categories")
            .select("id, name, active, display_order"),
          fetchStoreCategoryMap(),
        ]);
        if (cancelled) return;
        let list = ((data as any[]) ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          active: c.active !== false,
        }));
        const allowed = effectiveStoreId ? storeMap[effectiveStoreId] : undefined;
        if (allowed && allowed.length) {
          const ids = new Set(allowed);
          list = list.filter((c) => ids.has(c.id));
        }
        // Igual ao resto do sistema: categorias em ordem alfabética.
        list.sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
        setCategories(list);
        setReportCategory((current) =>
          current !== "all" && current !== "none" && !list.some((c) => c.id === current)
            ? "all"
            : current,
        );
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveStoreId]);

  useEffect(() => {
    if (startDate && endDate) loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStoreId, reportCategory]);

  const storeLabel = effectiveStoreId
    ? stores.find((s) => s.id === effectiveStoreId)?.name ?? "Loja"
    : "Todas as lojas";

  const categoryLabel =
    reportCategory === "all"
      ? "Todas as categorias"
      : reportCategory === "none"
        ? "Sem categoria"
        : categories.find((c) => c.id === reportCategory)?.name ?? "Categoria";

  /** Nome do arquivo, com a categoria quando um filtro de categoria estiver ativo. */
  const fileBase = () => {
    const cat =
      reportCategory === "all"
        ? ""
        : "_" +
          categoryLabel
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase();
    return `relatorio_${startDate}_${endDate}${cat}`;
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const title = "Relatório de Vendas";
    const period = `Período: ${startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} até ${endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}`;
    doc.setFontSize(16);
    doc.text(title, 14, 18);
    doc.setFontSize(10);
    doc.text(period, 14, 26);
    doc.text(`Loja: ${storeLabel}  |  Categoria: ${categoryLabel}`, 14, 32);
    doc.text(`Total de Vendas: R$ ${totalSales.toFixed(2)}`, 14, 38);
    doc.text(`Número de Vendas: ${salesCount}`, 14, 44);
    doc.text(`Ticket Médio: R$ ${salesCount > 0 ? (totalSales / salesCount).toFixed(2) : '0.00'}`, 14, 50);

    autoTable(doc, {
      startY: 58,
      head: [["Data", "Total (R$)"]],
      body: salesData.map((s) => [s.date, Number(s.total).toFixed(2)]),
      headStyles: { fillColor: [136, 132, 216] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Produto", "Qtd", "Valor Total (R$)"]],
      body: productSalesData.map((p) => [p.name, p.quantity, p.totalValue.toFixed(2)]),
      headStyles: { fillColor: [130, 202, 157] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Vendedor", "Qtd Vendas", "Valor Total (R$)"]],
      body: sellerData.map((s) => [s.name, s.salesCount, s.totalValue.toFixed(2)]),
      headStyles: { fillColor: [255, 193, 7] },
    });

    doc.save(`${fileBase()}.pdf`);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Indicador: "Loja", Valor: storeLabel },
      { Indicador: "Categoria", Valor: categoryLabel },
      { Indicador: "Período", Valor: `${startDate} a ${endDate}` },
      { Indicador: "Total de Vendas (R$)", Valor: Number(totalSales.toFixed(2)) },
      { Indicador: "Número de Vendas", Valor: salesCount },
      { Indicador: "Ticket Médio (R$)", Valor: salesCount > 0 ? Number((totalSales / salesCount).toFixed(2)) : 0 },
    ]), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData.map((s) => ({ Data: s.date, "Total (R$)": Number(Number(s.total).toFixed(2)) }))), "Vendas por dia");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productSalesData.map((p) => ({ Produto: p.name, Quantidade: p.quantity, "Valor Total (R$)": Number(p.totalValue.toFixed(2)) }))), "Produtos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sellerData.map((s) => ({ Vendedor: s.name, "Qtd Vendas": s.salesCount, "Valor Total (R$)": Number(s.totalValue.toFixed(2)) }))), "Vendedores");
    XLSX.writeFile(wb, `${fileBase()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      <h2 className="text-2xl font-bold">Relatórios — {storeLabel} | {categoryLabel}</h2>
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isSuperAdmin && (
              <div>
                <Label>Loja</Label>
                <Select value={reportStore} onValueChange={setReportStore}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}{s.active ? "" : " (inativa)"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Categoria</Label>
              <Select value={reportCategory} onValueChange={setReportCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.active ? "" : " (inativa)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => loadReports()} disabled={isLoading}>
                {isLoading ? "Carregando..." : "Atualizar"}
              </Button>
              <Button onClick={exportPDF} variant="outline" disabled={isLoading || salesData.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
              <Button onClick={exportExcel} variant="outline" disabled={isLoading || salesData.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalSales.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Número de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Itens Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itemsSold}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {salesCount > 0 ? (totalSales / salesCount).toFixed(2) : '0.00'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Data</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`R$ ${Number(value).toFixed(2)}`, 'Total']} />
                <Bar dataKey="total" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendas por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {sellerData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Vendedor</th>
                      <th className="text-right py-2 px-4">Quantidade de Vendas</th>
                      <th className="text-right py-2 px-4">Valor Total</th>
                      <th className="w-1/3 py-2 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellerData.map((seller, index) => {
                      const maxTotal = sellerData[0]?.totalValue || 1;
                      const barWidth = (seller.totalValue / maxTotal) * 100;

                      return (
                        <tr
                          key={index}
                          className={`border-b ${index === 0 ? 'bg-primary/10' : ''}`}
                        >
                          <td className="py-3 px-4 font-medium">{seller.name}</td>
                          <td className="text-right py-3 px-4">{seller.salesCount}</td>
                          <td className="text-right py-3 px-4">R$ {seller.totalValue.toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <div className="w-full bg-secondary rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma venda por vendedor neste período.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Produtos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={productData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="quantity"
                label={({ name, quantity }) => `${name}: ${quantity}`}
              >
                {productData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Produtos Mais Vendidos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos Mais Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {productSalesData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Nome do Produto</th>
                    <th className="text-right py-2 px-4">Quantidade Vendida</th>
                    <th className="text-right py-2 px-4">Valor Total</th>
                    <th className="w-1/3 py-2 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {productSalesData.map((product, index) => {
                    const maxQuantity = productSalesData[0]?.quantity || 1;
                    const barWidth = (product.quantity / maxQuantity) * 100;

                    return (
                      <tr
                        key={index}
                        className={`border-b ${index === 0 ? 'bg-primary/10' : ''}`}
                      >
                        <td className="py-3 px-4 font-medium">{product.name}</td>
                        <td className="text-right py-3 px-4">{product.quantity}</td>
                        <td className="text-right py-3 px-4">R$ {product.totalValue.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum produto vendido neste período.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};