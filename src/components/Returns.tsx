import { useState, useEffect } from "react";
import { usePdvControls } from "@/contexts/PdvControlsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { StoreFilterSelect } from "@/components/StoreFilterSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackToMainButton } from "@/components/ui/BackToMainButton";

import { useExportFilter } from "@/components/ui/ExportBar";
const brl=(n:any)=>`R$ ${Number(n||0).toFixed(2)}`;
const dt=(s:any)=>s?new Date(s).toLocaleString("pt-BR"):"";

interface Sale {
  id: string;
  sale_number?: number | null;
  total: number;
  customer_name?: string;
  created_at: string;
  sale_items: {
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    products?: {
      name: string;
    };
  }[];
}

interface Return {
  id: string;
  sale_id: string;
  item_id: string;
  quantity: number;
  reason: string;
  status: string;
  created_at: string;
  sales?: {
    customer_name?: string;
  };
  sale_items?: {
    products?: {
      name: string;
    };
  };
}

interface ReturnsProps {
  onBackToMain: () => void;
}

export const Returns = ({ onBackToMain }: ReturnsProps) => {
  const [returns, setReturns] = useState<Return[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchSaleId, setSearchSaleId] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [formData, setFormData] = useState({
    item_id: "",
    quantity: "",
    reason: "",
  });
  const { toast } = useToast();
  const { scopeStoreId } = useStore();
  const { isBlocked: isControlBlocked, messageFor: controlMessage } = usePdvControls();

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("returns")
        .select(`
          *,
          sales (customer_name),
          sale_items (
            products (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReturns(data || []);
    } catch (error) {
      console.error("Error fetching returns:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as devoluções",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchSale = async () => {
    const term = searchSaleId.trim().replace(/^#/, "");
    if (!term) {
      toast({
        title: "Erro",
        description: "Digite o número da venda",
        variant: "destructive",
      });
      return;
    }

    try {
      const select = `
        *,
        sale_items (
          *,
          products (name)
        )
      `;

      let query = supabase.from("sales").select(select);
      if (scopeStoreId) query = query.eq("store_id", scopeStoreId);

      const isNumber = /^\d+$/.test(term);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);

      if (isNumber) {
        query = query.eq("sale_number", parseInt(term, 10));
      } else if (isUuid) {
        query = query.eq("id", term);
      } else {
        toast({
          title: "Erro",
          description: "Informe o número do pedido (somente números)",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Erro",
          description: "Venda não encontrada",
          variant: "destructive",
        });
        return;
      }

      setSelectedSale(data as unknown as Sale);
    } catch (error) {
      console.error("Error searching sale:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar venda",
        variant: "destructive",
      });
    }
  };

  const handleCreateReturn = async () => {
    if (!selectedSale || !formData.item_id || !formData.quantity || !formData.reason) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const selectedItem = selectedSale.sale_items.find(item => item.id === formData.item_id);
    if (!selectedItem) {
      toast({
        title: "Erro",
        description: "Item não encontrado",
        variant: "destructive",
      });
      return;
    }

    const returnQuantity = parseInt(formData.quantity);
    if (returnQuantity <= 0 || returnQuantity > selectedItem.quantity) {
      toast({
        title: "Erro",
        description: "Quantidade inválida",
        variant: "destructive",
      });
      return;
    }

    if (isControlBlocked("sales")) {
      toast({ title: "Operação bloqueada", description: controlMessage("sales"), variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from("returns")
        .insert([{
          sale_id: selectedSale.id,
          item_id: formData.item_id,
          quantity: returnQuantity,
          reason: formData.reason,
          status: "pending",
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Devolução registrada com sucesso",
      });

      setDialogOpen(false);
      setSelectedSale(null);
      setSearchSaleId("");
      setFormData({
        item_id: "",
        quantity: "",
        reason: "",
      });
      fetchReturns();
    } catch (error) {
      console.error("Error creating return:", error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar a devolução",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: "Pendente", variant: "secondary" as const },
      approved: { label: "Aprovada", variant: "default" as const },
      rejected: { label: "Rejeitada", variant: "destructive" as const },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.pending;
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const { filtered, bar } = useExportFilter(returns, {
    title: "Devoluções", getDate: (r) => r.created_at,
    columns: [
      { header: "Devolução", value: (r) => r.id.slice(-8).toUpperCase() },
      { header: "Data", value: (r) => dt(r.created_at) },
      { header: "Cliente", value: (r) => r.sales?.customer_name },
      { header: "Produto", value: (r) => r.sale_items?.products?.name },
      { header: "Quantidade", value: (r) => r.quantity },
      { header: "Motivo", value: (r) => r.reason },
      { header: "Status", value: (r) => r.status },
    ],
  });

  return (
    <div className="p-6 space-y-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      {bar}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Devoluções</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Devolução
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova Devolução</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Número do pedido (ex: 12)"
                  value={searchSaleId}
                  onChange={(e) => setSearchSaleId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchSale()}
                />
                <Button onClick={searchSale}>
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </Button>
              </div>

              {selectedSale && (
                <Card>
                  <CardHeader>
                    <CardTitle>Venda #{selectedSale.sale_number != null ? String(selectedSale.sale_number).padStart(2, "0") : selectedSale.id.slice(-8).toUpperCase()}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Cliente: {selectedSale.customer_name || "Não informado"} | 
                      Data: {formatDate(selectedSale.created_at)} |
                      Total: {formatCurrency(selectedSale.total)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="item_id">Item para Devolução *</Label>
                        <Select value={formData.item_id} onValueChange={(value) => setFormData({ ...formData, item_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o item" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedSale.sale_items.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.products?.name || "Produto não encontrado"} - Qtd: {item.quantity} - {formatCurrency(item.unit_price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.item_id && (
                        <div>
                          <Label htmlFor="quantity">Quantidade *</Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            max={selectedSale.sale_items.find(item => item.id === formData.item_id)?.quantity || 1}
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            placeholder="Quantidade a devolver"
                          />
                        </div>
                      )}

                      <div>
                        <Label htmlFor="reason">Motivo da Devolução *</Label>
                        <Textarea
                          id="reason"
                          value={formData.reason}
                          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                          placeholder="Descreva o motivo da devolução"
                        />
                      </div>

                      <Button onClick={handleCreateReturn} className="w-full">
                        Registrar Devolução
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p>Carregando devoluções...</p>
      ) : (
        <div className="grid gap-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Nenhuma devolução registrada</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((returnItem) => (
              <Card key={returnItem.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        <RotateCcw className="w-4 h-4 inline mr-2" />
                        Devolução #{returnItem.id.slice(-8).toUpperCase()}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(returnItem.created_at)}
                      </p>
                    </div>
                    {getStatusBadge(returnItem.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Cliente:</strong> {returnItem.sales?.customer_name || "Não informado"}
                    </div>
                    <div>
                      <strong>Produto:</strong> {returnItem.sale_items?.products?.name || "Produto não encontrado"}
                    </div>
                    <div>
                      <strong>Quantidade:</strong> {returnItem.quantity}
                    </div>
                    <div>
                      <strong>Venda ID:</strong> #{returnItem.sale_id.slice(-8).toUpperCase()}
                    </div>
                    <div className="col-span-2">
                      <strong>Motivo:</strong> {returnItem.reason}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};