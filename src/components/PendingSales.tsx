import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Play, Printer, Share2, Mail } from "lucide-react";
import { BackToMainButton } from "@/components/ui/BackToMainButton";
import { printSaleReceipt } from "@/lib/printSaleReceipt";
import { shareSaleEmail, shareSaleWhatsApp } from "@/lib/shareSale";
import { separateLineItems } from "@/lib/separateLineItems";
import { useStore } from "@/contexts/StoreContext";
import { StoreFilterSelect } from "@/components/StoreFilterSelect";

import { useExportFilter } from "@/components/ui/ExportBar";
const brl=(n:any)=>`R$ ${Number(n||0).toFixed(2)}`;
const dt=(s:any)=>s?new Date(s).toLocaleString("pt-BR"):"";

interface PendingSale {
  id: string;
  sale_number: number | null;
  total: number;
  customer_name: string;
  created_at: string;
  seller_id?: string | null;
  sellers?: { name: string } | null;
  sale_items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes?: string | null;
    products: {
      name: string;
    };
  }>;
}

interface PendingSalesProps {
  onLoadSale: (items: any[], saleId: string, customerName: string, itemNotes?: Record<string, string>, saleNotes?: string) => void;
  onBackToMain: () => void;
}

export const PendingSales = ({ onLoadSale, onBackToMain }: PendingSalesProps) => {
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { scopeStoreId } = useStore();

  useEffect(() => {
    fetchPendingSales();
  }, [scopeStoreId]);

  const fetchPendingSales = async () => {
    try {
      // Use demo user ID for the demo
      const demoUserId = "00000000-0000-0000-0000-000000000000";

      let q = supabase
        .from('sales')
        .select(`
          *,
          sellers (name),
          sale_items (
            *,
            product_id,
            products (name, image_url)
          )
        `)
        .eq('status', 'pending')
        .eq('user_id', demoUserId)
        .order('updated_at', { ascending: false });
      if (scopeStoreId) q = q.eq('store_id', scopeStoreId);
      const { data, error } = await q;

      if (error) throw error;
      setPendingSales(
        (data || []).map((sale) => ({
          ...sale,
          sale_items: separateLineItems(sale.sale_items || []),
        }))
      );
    } catch (error) {
      console.error('Error fetching pending sales:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar vendas em aberto",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSale = async (sale: PendingSale) => {
    try {
      // Get the actual product data to correctly map to cart items
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, image_url')
        .in('id', sale.sale_items.map(item => item.product_id || ''));

      const cartItems = sale.sale_items.map(item => {
        const product = productsData?.find(p => p.id === item.product_id);
        return {
          id: `item-${item.id}`,
          productId: item.product_id,
          name: product?.name || item.products?.name || "Produto",
          price: item.unit_price,
          quantity: item.quantity,
          image: product?.image_url || "/placeholder.svg"
        };
      });

      const itemNotes: Record<string, string> = {};
      sale.sale_items.forEach((item) => {
        const key = `item-${item.id}`;
        if (item.notes) itemNotes[key] = item.notes;
      });

      onLoadSale(cartItems, sale.id, sale.customer_name, itemNotes, (sale as any).notes || "");
      
      toast({
        title: "Pedido carregado!",
        description: `Pedido de ${sale.customer_name} foi carregado no carrinho`,
        duration: 2000,
      });

      // Don't delete the sale here anymore - it will be handled when checkout is completed
    } catch (error) {
      console.error('Error loading sale:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar pedido",
        variant: "destructive"
      });
    }
  };

  const deleteSale = async (saleId: string) => {
    try {
      await supabase.from('sales').delete().eq('id', saleId);
      toast({
        title: "Venda excluída",
        description: "Venda foi removida das vendas em aberto",
      });
      fetchPendingSales();
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir venda",
        variant: "destructive"
      });
    }
  };

  const { filtered, bar } = useExportFilter(pendingSales, {
    title: "Vendas em Aberto", getDate: (r) => r.created_at,
    columns: [
      { header: "Pedido", value: (r) => String(r.sale_number ?? "").padStart(2, "0") },
      { header: "Cliente", value: (r) => r.customer_name },
      { header: "Vendedor", value: (r) => r.sellers?.name },
      { header: "Data", value: (r) => dt(r.created_at) },
      { header: "Itens", value: (r) => r.sale_items.map((i) => `${i.quantity}x ${i.products?.name}`).join("; ") },
      { header: "Total", value: (r) => brl(r.total) },
    ],
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando vendas em aberto...</div>;
  }


  return (
    <div className="space-y-4">
      <BackToMainButton onBackToMain={onBackToMain} />
      {bar}
      <h2 className="text-2xl font-bold">Vendas em Aberto</h2>
      
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Nenhuma venda em aberto</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((sale) => (
            <Card key={sale.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{sale.customer_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {new Date(sale.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    R$ {sale.total.toFixed(2)}
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => loadSale(sale)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Carregar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
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
                        date: new Date(sale.created_at),
                        orderNumber: String(sale.sale_number ?? 0).padStart(2, "0"),
                        notes: (sale as any).notes || undefined,
                      })
                    }
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
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
                        notes: (sale as any).notes || undefined,
                      })
                    }
                  >
                    <Share2 className="h-4 w-4 mr-1" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
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
                        notes: (sale as any).notes || undefined,
                      })
                    }
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    Email
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteSale(sale.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sale.sale_items.map((item) => (
                    <div key={item.id} className="text-sm">
                      <div className="flex justify-between">
                        <span>{item.quantity}x {item.products?.name}</span>
                        <span>R$ {item.total_price.toFixed(2)}</span>
                      </div>
                      {item.notes && (
                        <p className="text-xs italic text-muted-foreground pl-2">Obs.: {item.notes}</p>
                      )}
                    </div>
                  ))}
                  {(sale as any).notes && (
                    <div className="mt-2 rounded-md bg-muted p-2">
                      <p className="text-xs font-medium text-foreground">Observações do pedido</p>
                      <p className="text-xs italic text-muted-foreground whitespace-pre-wrap">
                        {(sale as any).notes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};