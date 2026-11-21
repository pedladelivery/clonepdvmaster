import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";
import { BackToMainButton } from "@/components/ui/BackToMainButton";
import { useExportFilter } from "@/components/ui/ExportBar";
import { useStore } from "@/contexts/StoreContext";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  address?: string;
  observacoes?: string;
  created_at: string;
}

interface CustomerManagementProps {
  onBackToMain: () => void;
}

export const CustomerManagement = ({ onBackToMain }: CustomerManagementProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birth_date: "",
    address: "",
    observacoes: ""
  });
  const { toast } = useToast();

  const { scopeStoreId, writeStoreId } = useStore();

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeStoreId]);

  const fetchCustomers = async () => {
    let q = supabase.from('customers').select('*').order('name');
    if (scopeStoreId) q = q.eq('store_id', scopeStoreId);
    const { data, error } = await q;
    if (error) { console.error('Error fetching customers:', error); return; }
    setCustomers((data || []) as any);
  };

  const saveCustomer = async () => {
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email || null,
        phone: formData.phone || null,
        birth_date: formData.birth_date || null,
        address: formData.address || null,
        observacoes: formData.observacoes || null,
      };
      const { error } = editingCustomer
        ? await supabase.from('customers').update(payload).eq('id', editingCustomer.id)
        : await supabase.from('customers').insert([{ ...payload, store_id: scopeStoreId ?? writeStoreId ?? null }]);
      if (error) throw error;
      toast({ title: editingCustomer ? "Cliente atualizado" : "Cliente cadastrado" });
      setIsDialogOpen(false);
      setEditingCustomer(null);
      setFormData({ name: "", email: "", phone: "", birth_date: "", address: "", observacoes: "" });
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({ title: "Erro", description: "Falha ao salvar cliente", variant: "destructive" });
    }
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      toast({ title: "Erro", description: "Falha ao excluir cliente", variant: "destructive" });
      return;
    }
    toast({ title: "Cliente excluído" });
    fetchCustomers();
  };

  const { filtered, bar } = useExportFilter(customers, {
    title: "Clientes",
    getDate: (c) => c.created_at,
    columns: [
      { header: "Nome", value: (c) => c.name },
      { header: "Email", value: (c) => c.email },
      { header: "Telefone", value: (c) => c.phone },
      { header: "Aniversário", value: (c) => c.birth_date ? new Date(c.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : "" },
      { header: "Endereço", value: (c) => c.address },
      { header: "Observações", value: (c) => (c as Customer).observacoes },
      { header: "Cadastro", value: (c) => new Date(c.created_at).toLocaleDateString('pt-BR') },
    ],
  });

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      birth_date: customer.birth_date || "",
      address: customer.address || "",
      observacoes: customer.observacoes || ""
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestão de Clientes</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingCustomer(null);
              setFormData({ name: "", email: "", phone: "", birth_date: "", address: "", observacoes: "" });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
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
                <Label htmlFor="birth_date">Data de Nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
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
                  placeholder="Anotações sobre o cliente"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveCustomer} disabled={!formData.name}>
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {bar}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Aniversário</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.email || "-"}</TableCell>
                  <TableCell>{customer.phone || "-"}</TableCell>
                  <TableCell>
                    {customer.birth_date 
                      ? new Date(customer.birth_date).toLocaleDateString('pt-BR')
                      : "-"
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(customer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteCustomer(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cliente cadastrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};