import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BackToMainButton } from "@/components/ui/BackToMainButton";

import { useExportFilter } from "@/components/ui/ExportBar";
const brl=(n:any)=>`R$ ${Number(n||0).toFixed(2)}`;
const dt=(s:any)=>s?new Date(s).toLocaleString("pt-BR"):"";

interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  observacoes?: string;
  created_at: string;
}

interface SupplierManagementProps {
  onBackToMain: () => void;
}

export const SupplierManagement = ({ onBackToMain }: SupplierManagementProps) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    contact_person: "",
    observacoes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os fornecedores",
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

    try {
      const payload = {
        ...formData,
        observacoes: formData.observacoes || null,
      };
      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", editingSupplier.id);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Fornecedor atualizado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert([payload]);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Fornecedor cadastrado com sucesso",
        });
      }

      setDialogOpen(false);
      setEditingSupplier(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
        contact_person: "",
        observacoes: "",
      });
      fetchSuppliers();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o fornecedor",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      contact_person: supplier.contact_person || "",
      observacoes: supplier.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (supplierId: string) => {
    if (!confirm("Tem certeza que deseja excluir este fornecedor?")) return;

    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);

      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Fornecedor excluído com sucesso",
      });
      fetchSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o fornecedor",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingSupplier(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      contact_person: "",
      observacoes: "",
    });
  };

  const { filtered, bar } = useExportFilter(suppliers, {
    title: "Fornecedores", getDate: (r) => r.created_at,
    columns: [
      { header: "Nome", value: (r) => r.name },
      { header: "Contato", value: (r) => r.contact_person },
      { header: "Email", value: (r) => r.email },
      { header: "Telefone", value: (r) => r.phone },
      { header: "Endereço", value: (r) => r.address },
      { header: "Observações", value: (r) => r.observacoes },
    ],
  });

  return (
    <div className="p-6 space-y-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      {bar}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Fornecedores</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@fornecedor.com"
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
                <Label htmlFor="contact_person">Pessoa de Contato</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Nome do contato"
                />
              </div>
              <div>
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Endereço completo"
                />
              </div>
              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <textarea
                  id="observacoes"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Anotações sobre o fornecedor"
                />
              </div>
              <Button onClick={handleSave} className="w-full">
                {editingSupplier ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p>Carregando fornecedores...</p>
      ) : (
        <div className="grid gap-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Nenhum fornecedor cadastrado</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((supplier) => (
              <Card key={supplier.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{supplier.name}</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(supplier)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(supplier.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {supplier.email && (
                      <div>
                        <strong>Email:</strong> {supplier.email}
                      </div>
                    )}
                    {supplier.phone && (
                      <div>
                        <strong>Telefone:</strong> {supplier.phone}
                      </div>
                    )}
                    {supplier.contact_person && (
                      <div>
                        <strong>Contato:</strong> {supplier.contact_person}
                      </div>
                    )}
                    {supplier.address && (
                      <div className="col-span-2">
                        <strong>Endereço:</strong> {supplier.address}
                      </div>
                    )}
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