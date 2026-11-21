import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackToMainButton } from "@/components/ui/BackToMainButton";
import { useStore } from "@/contexts/StoreContext";
import { StoreFilterSelect } from "@/components/StoreFilterSelect";
import { adjustStoreStock } from "@/lib/stock";

import { useExportFilter } from "@/components/ui/ExportBar";
const brl=(n:any)=>`R$ ${Number(n||0).toFixed(2)}`;
const dt=(s:any)=>s?new Date(s).toLocaleString("pt-BR"):"";

interface Product {
  id: string;
  name: string;
  category_id: string;
  stock_quantity?: number;
  min_stock?: number;
  active: boolean;
}

interface StockMovement {
  id: string;
  product_id: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  created_at: string;
  products?: {
    name: string;
  };
}

interface StockManagementProps {
  onBackToMain: () => void;
}

export const StockManagement = ({ onBackToMain }: StockManagementProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockForm, setStockForm] = useState({
    product_id: "",
    min_stock: "",
  });
  const [movementForm, setMovementForm] = useState({
    product_id: "",
    type: "" as 'in' | 'out' | '',
    quantity: "",
    reason: "",
  });
  const { toast } = useToast();
  const { scopeStoreId, writeStoreId } = useStore();

  useEffect(() => {
    fetchProducts();
    fetchMovements();
  }, [scopeStoreId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("name");

      if (error) throw error;

      // Saldo por loja (produto é global, estoque é individual)
      let stockQuery = supabase
        .from("store_stock")
        .select("product_id, stock_quantity, min_stock");
      if (scopeStoreId) stockQuery = stockQuery.eq("store_id", scopeStoreId);
      const { data: stockRows, error: stockError } = await stockQuery;
      if (stockError) throw stockError;

      const byProduct = new Map<string, { stock_quantity: number; min_stock: number }>();
      (stockRows || []).forEach((row) => {
        const current = byProduct.get(row.product_id) || { stock_quantity: 0, min_stock: 0 };
        byProduct.set(row.product_id, {
          stock_quantity: current.stock_quantity + Number(row.stock_quantity || 0),
          min_stock: Math.max(current.min_stock, Number(row.min_stock || 0)),
        });
      });

      setProducts(
        (data || []).map((p) => ({
          ...p,
          stock_quantity: byProduct.get(p.id)?.stock_quantity ?? 0,
          min_stock: byProduct.get(p.id)?.min_stock ?? 0,
        })),
      );
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os produtos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      let q = supabase
        .from("stock_movements")
        .select(`
          *,
          products (name)
        `)
        .order("created_at", { ascending: false })
        .limit(20);
      if (scopeStoreId) q = q.eq("store_id", scopeStoreId);
      const { data, error } = await q;

      if (error) throw error;
      setMovements((data || []) as StockMovement[]);
    } catch (error) {
      console.error("Error fetching movements:", error);
    }
  };

  const handleUpdateStock = async () => {
    if (!stockForm.product_id || !stockForm.min_stock) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("store_stock")
        .upsert(
          {
            store_id: writeStoreId!,
            product_id: stockForm.product_id,
            min_stock: parseInt(stockForm.min_stock),
          },
          { onConflict: "store_id,product_id" },
        );

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Estoque mínimo atualizado com sucesso",
      });

      setDialogOpen(false);
      setStockForm({
        product_id: "",
        min_stock: "",
      });
      fetchProducts();
    } catch (error) {
      console.error("Error updating stock:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o estoque",
        variant: "destructive",
      });
    }
  };

  const handleStockMovement = async () => {
    if (!movementForm.product_id || !movementForm.type || !movementForm.quantity || !movementForm.reason) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(movementForm.quantity);
    if (quantity <= 0) {
      toast({
        title: "Erro",
        description: "Quantidade deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    try {
      // Atualizar o saldo apenas da loja ativa
      await adjustStoreStock(
        writeStoreId!,
        movementForm.product_id,
        movementForm.type === "in" ? quantity : -quantity,
      );

      // Registrar movimento
      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert([{
          product_id: movementForm.product_id,
          type: movementForm.type,
          quantity: quantity,
          reason: movementForm.reason,
          store_id: writeStoreId!,
        }]);

      if (movementError) throw movementError;

      toast({
        title: "Sucesso",
        description: "Movimentação de estoque registrada com sucesso",
      });

      setMovementDialogOpen(false);
      setMovementForm({
        product_id: "",
        type: "",
        quantity: "",
        reason: "",
      });
      fetchProducts();
      fetchMovements();
    } catch (error) {
      console.error("Error processing stock movement:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a movimentação",
        variant: "destructive",
      });
    }
  };

  const getStockStatus = (product: Product) => {
    const stock = product.stock_quantity || 0;
    const minStock = product.min_stock || 0;

    if (stock === 0) {
      return { label: "Sem Estoque", variant: "destructive" as const, icon: AlertTriangle };
    }
    if (stock <= minStock) {
      return { label: "Estoque Baixo", variant: "secondary" as const, icon: AlertTriangle };
    }
    return { label: "Em Estoque", variant: "default" as const, icon: Package };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const { filtered, bar } = useExportFilter(products, {
    title: "Status do Estoque",
    columns: [
      { header: "Produto", value: (r) => r.name },
      { header: "Estoque", value: (r) => r.stock_quantity || 0 },
      { header: "Mínimo", value: (r) => r.min_stock || 0 },
      { header: "Situação", value: (r) => ((r.stock_quantity || 0) <= 0 ? "Sem estoque" : (r.stock_quantity || 0) <= (r.min_stock || 0) ? "Estoque baixo" : "Normal") },
    ],
  });
  const { filtered: filteredMov, bar: movBar } = useExportFilter(movements, {
    title: "Movimentações de Estoque", getDate: (r) => r.created_at,
    columns: [
      { header: "Data", value: (r) => dt(r.created_at) },
      { header: "Produto", value: (r) => r.products?.name },
      { header: "Tipo", value: (r) => (r.type === "in" ? "Entrada" : "Saída") },
      { header: "Quantidade", value: (r) => r.quantity },
      { header: "Motivo", value: (r) => r.reason },
    ],
  });

  return (
    <div className="p-6 space-y-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      {bar}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Controle de Estoque</h2>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Package className="w-4 h-4 mr-2" />
                Configurar Estoque
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar Estoque Mínimo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="product">Produto</Label>
                  <Select value={stockForm.product_id} onValueChange={(value) => setStockForm({ ...stockForm, product_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="min_stock">Estoque Mínimo</Label>
                  <Input
                    id="min_stock"
                    type="number"
                    min="0"
                    value={stockForm.min_stock}
                    onChange={(e) => setStockForm({ ...stockForm, min_stock: e.target.value })}
                    placeholder="Quantidade mínima"
                  />
                </div>
                <Button onClick={handleUpdateStock} className="w-full">
                  Atualizar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Movimentação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Movimentação de Estoque</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="product">Produto</Label>
                  <Select value={movementForm.product_id} onValueChange={(value) => setMovementForm({ ...movementForm, product_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (Estoque: {product.stock_quantity || 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="type">Tipo de Movimentação</Label>
                  <Select value={movementForm.type} onValueChange={(value: 'in' | 'out') => setMovementForm({ ...movementForm, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Entrada</SelectItem>
                      <SelectItem value="out">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantidade</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                    placeholder="Quantidade"
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Motivo</Label>
                  <Input
                    id="reason"
                    value={movementForm.reason}
                    onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                    placeholder="Motivo da movimentação"
                  />
                </div>
                <Button onClick={handleStockMovement} className="w-full">
                  Registrar Movimentação
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Status do Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Carregando produtos...</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((product) => {
                  const status = getStockStatus(product);
                  const StatusIcon = status.icon;
                  
                  return (
                    <div key={product.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Estoque: {product.stock_quantity || 0} | Mínimo: {product.min_stock || 0}
                        </p>
                      </div>
                      <Badge variant={status.variant}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {movBar}
        <Card>
          <CardHeader>
            <CardTitle>Últimas Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredMov.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma movimentação registrada</p>
              ) : (
                filteredMov.map((movement) => (
                  <div key={movement.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{movement.products?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {movement.reason} • {formatDate(movement.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {movement.type === 'in' ? (
                        <Plus className="w-4 h-4 text-green-600" />
                      ) : (
                        <Minus className="w-4 h-4 text-red-600" />
                      )}
                      <span className={movement.type === 'in' ? 'text-green-600' : 'text-red-600'}>
                        {movement.quantity}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};