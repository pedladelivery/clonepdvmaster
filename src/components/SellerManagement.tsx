import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BackToMainButton } from "@/components/ui/BackToMainButton";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/contexts/StoreContext";
import { fetchSellerStoreMap, saveSellerStores } from "@/lib/sellerStores";

import { useExportFilter } from "@/components/ui/ExportBar";
const brl=(n:any)=>`R$ ${Number(n||0).toFixed(2)}`;
const dt=(s:any)=>s?new Date(s).toLocaleString("pt-BR"):"";

interface Seller {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  commission_rate?: number;
  active?: boolean;
  created_at: string;
}

interface SellerManagementProps {
  onBackToMain: () => void;
}

export const SellerManagement = ({ onBackToMain }: SellerManagementProps) => {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    commission_rate: "",
    active: true,
  });
  const { toast } = useToast();
  const { stores } = useStore();
  const [storeMap, setStoreMap] = useState<Record<string, string[]>>({});
  const [selStores, setSelStores] = useState<string[]>([]);

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sellers")
        .select("*")
        .order("name");

      if (error) throw error;
      setSellers(data || []);
      setStoreMap(await fetchSellerStoreMap());
    } catch (error) {
      console.error("Error fetching sellers:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os vendedores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const commission = formData.commission_rate ? parseFloat(formData.commission_rate) : 0;
    if (commission < 0 || commission > 100) {
      toast({
        title: "Erro",
        description: "Taxa de comissão deve estar entre 0% e 100%",
        variant: "destructive",
      });
      return;
    }

    if (selStores.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos uma loja", variant: "destructive" });
      return;
    }
    try {
      const saveData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        commission_rate: commission,
        active: formData.active,
      };

      if (editingSeller) {
        const { error } = await supabase
          .from("sellers")
          .update(saveData)
          .eq("id", editingSeller.id);

        if (error) throw error;
        await saveSellerStores(editingSeller.id, selStores);
        toast({
          title: "Sucesso",
          description: "Vendedor atualizado com sucesso",
        });
      } else {
        const { data: inserted, error } = await supabase
          .from("sellers")
          .insert([saveData])
          .select("id")
          .single();

        if (error) throw error;
        await saveSellerStores(inserted.id, selStores);
        toast({
          title: "Sucesso",
          description: "Vendedor cadastrado com sucesso",
        });
      }

      setDialogOpen(false);
      setEditingSeller(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        commission_rate: "",
        active: true,
      });
      fetchSellers();
    } catch (error) {
      console.error("Error saving seller:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o vendedor",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (seller: Seller) => {
    setEditingSeller(seller);
    setFormData({
      name: seller.name,
      email: seller.email || "",
      phone: seller.phone || "",
      commission_rate: seller.commission_rate?.toString() || "",
      active: seller.active ?? true,
    });
    setSelStores(storeMap[seller.id] ?? []);
    setDialogOpen(true);
  };

  const handleDelete = async (sellerId: string) => {
    if (!confirm("Tem certeza que deseja excluir este vendedor?")) return;

    try {
      const { error } = await supabase
        .from("sellers")
        .delete()
        .eq("id", sellerId);

      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Vendedor excluído com sucesso",
      });
      fetchSellers();
    } catch (error) {
      console.error("Error deleting seller:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o vendedor",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingSeller(null);
    setSelStores([]);
    setFormData({
      name: "",
      email: "",
      phone: "",
      commission_rate: "",
      active: true,
    });
  };

  const { filtered, bar } = useExportFilter(sellers, {
    title: "Vendedores", getDate: (r) => r.created_at,
    columns: [
      { header: "Nome", value: (r) => r.name },
      { header: "Email", value: (r) => r.email },
      { header: "Telefone", value: (r) => r.phone },
      { header: "Comissão (%)", value: (r) => r.commission_rate ?? 0 },
      { header: "Status", value: (r) => (r.active ? "Ativo" : "Inativo") },
      { header: "Lojas", value: (r) => (storeMap[r.id] ?? []).map((id) => stores.find((x) => x.id === id)?.name).filter(Boolean).join(", ") },
    ],
  });

  return (
    <div className="p-6 space-y-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      {bar}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Vendedores</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Vendedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSeller ? "Editar Vendedor" : "Novo Vendedor"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do vendedor"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@vendedor.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label htmlFor="commission_rate">Taxa de Comissão (%)</Label>
                <Input
                  id="commission_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Lojas *</Label>
                <div className="mt-2 space-y-2 rounded-md border p-3">
                  {stores.map((st) => (
                    <label key={st.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selStores.includes(st.id)}
                        onCheckedChange={(c) =>
                          setSelStores((prev) => c ? [...prev, st.id] : prev.filter((x) => x !== st.id))
                        }
                      />
                      {st.name}{st.active ? "" : " (inativa)"}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Vendedor Ativo</Label>
              </div>
              <Button onClick={handleSave} className="w-full">
                {editingSeller ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p>Carregando vendedores...</p>
      ) : (
        <div className="grid gap-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Nenhum vendedor cadastrado</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((seller) => (
              <Card key={seller.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <CardTitle>{seller.name}</CardTitle>
                      <Badge variant={seller.active ? "default" : "secondary"}>
                        {seller.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(seller)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(seller.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {seller.email && (
                      <div>
                        <strong>Email:</strong> {seller.email}
                      </div>
                    )}
                    {seller.phone && (
                      <div>
                        <strong>Telefone:</strong> {seller.phone}
                      </div>
                    )}
                    <div>
                      <strong>Comissão:</strong> {seller.commission_rate || 0}%
                    </div>
                    <div className="col-span-2">
                      <strong>Lojas:</strong>{" "}
                      {(storeMap[seller.id] ?? []).map((id) => stores.find((x) => x.id === id)?.name).filter(Boolean).join(", ") || "Nenhuma"}
                    </div>
                    <div>
                      <strong>Cadastro:</strong> {new Date(seller.created_at).toLocaleDateString()}
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