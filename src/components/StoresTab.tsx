import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Store as StoreIcon, Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { useExportFilter } from "@/components/ui/ExportBar";

interface StoreRow {
  id: string;
  name: string;
  code: string | null;
  slug: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;
}

interface StoreStats {
  store_id: string;
  total: number;
  count: number;
}

const emptyForm = { name: "", code: "", slug: "", address: "", phone: "", active: true };

export const StoresTab = () => {
  const { toast } = useToast();
  const { refreshStores } = useStore();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [stats, setStats] = useState<Record<string, StoreStats>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StoreRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: storeData, error } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setStores((storeData || []) as StoreRow[]);

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("store_id, total, status, created_at")
        .eq("status", "completed")
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`);
      if (salesError) throw salesError;

      const map: Record<string, StoreStats> = {};
      (sales || []).forEach((s: any) => {
        if (!s.store_id) return;
        if (!map[s.store_id]) map[s.store_id] = { store_id: s.store_id, total: 0, count: 0 };
        map[s.store_id].total += Number(s.total || 0);
        map[s.store_id].count += 1;
      });
      setStats(map);
    } catch (e: any) {
      toast({ title: "Erro ao carregar lojas", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const consolidated = useMemo(() => {
    const values = Object.values(stats);
    const total = values.reduce((acc, s) => acc + s.total, 0);
    const count = values.reduce((acc, s) => acc + s.count, 0);
    return { total, count, average: count ? total / count : 0 };
  }, [stats]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const openEdit = (store: StoreRow) => {
    setEditing(store);
    setForm({
      name: store.name,
      code: store.code || "",
      slug: store.slug || "",
      address: store.address || "",
      phone: store.phone || "",
      active: store.active,
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Informe o nome da loja", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        slug: form.slug.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        active: form.active,
      };
      if (editing) {
        const { error } = await supabase.from("stores").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stores").insert([payload]);
        if (error) throw error;
      }
      toast({ title: editing ? "Loja atualizada" : "Loja criada" });
      setEditing(null);
      setForm(emptyForm);
      setDialogOpen(false);
      await loadAll();
      await refreshStores();
    } catch (e: any) {
      toast({ title: "Erro ao salvar loja", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (store: StoreRow) => {
    try {
      const { error } = await supabase.from("stores").update({ active: !store.active }).eq("id", store.id);
      if (error) throw error;
      await loadAll();
      await refreshStores();
    } catch (e: any) {
      toast({ title: "Erro ao alterar a loja", description: e.message, variant: "destructive" });
    }
  };

  const [dialogOpen, setDialogOpen] = useState(false);

  const { filtered: filteredStores, bar } = useExportFilter(stores, {
    title: "Visão Consolidada",
    subtitle: `Período: ${startDate} a ${endDate} | Total: R$ ${consolidated.total.toFixed(2)} | ${consolidated.count} vendas`,
    columns: [
      { header: "Loja", value: (s) => s.name },
      { header: "Código", value: (s) => s.code },
      { header: "Vendas no período", value: (s) => stats[s.id]?.count ?? 0 },
      { header: "Faturamento", value: (s) => `R$ ${(stats[s.id]?.total ?? 0).toFixed(2)}` },
      { header: "Ticket médio", value: (s) => { const x = stats[s.id]; return `R$ ${x?.count ? (x.total / x.count).toFixed(2) : "0.00"}`; } },
      { header: "Status", value: (s) => (s.active ? "Ativa" : "Inativa") },
    ],
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StoreIcon className="w-5 h-5" />
            Visão consolidada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stores-start">De</Label>
              <Input id="stores-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="stores-end">Até</Label>
              <Input id="stores-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Faturamento total</p>
              <p className="text-xl font-bold">R$ {consolidated.total.toFixed(2)}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Vendas</p>
              <p className="text-xl font-bold">{consolidated.count}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Ticket médio</p>
              <p className="text-xl font-bold">R$ {consolidated.average.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {bar}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <StoreIcon className="w-5 h-5" />
            Lojas
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              openNew();
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Nova loja
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Vendas no período</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStores.map((store) => {
                  const s = stats[store.id];
                  return (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium">{store.name}</TableCell>
                      <TableCell>{store.code || "—"}</TableCell>
                      <TableCell>{s?.count ?? 0}</TableCell>
                      <TableCell>R$ {(s?.total ?? 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={store.active ? "secondary" : "outline"}>
                          {store.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch checked={store.active} onCheckedChange={() => toggleActive(store)} />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              openEdit(store);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar loja" : "Nova loja"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="store-name">Nome *</Label>
              <Input id="store-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="store-code">Código</Label>
                <Input id="store-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="store-slug">Identificador</Label>
                <Input id="store-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="store-address">Endereço</Label>
              <Input id="store-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="store-phone">Telefone</Label>
              <Input id="store-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Loja ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
