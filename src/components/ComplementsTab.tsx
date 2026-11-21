import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Plus, Trash2, Link2 } from "lucide-react";

const db = supabase as any;

interface Group {
  id: string; name: string; description: string | null; min_select: number; max_select: number;
  required: boolean; active: boolean; display_order: number;
}
interface Item {
  id: string; group_id: string; name: string; description: string | null; price: number; image_url: string | null; active: boolean; display_order: number;
}
interface Link { product_id: string; group_id: string }
interface Product { id: string; name: string }

export const ComplementsTab = ({ products }: { products: Product[] }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState("");

  const load = async () => {
    const [g, i, l] = await Promise.all([
      db.from("complement_groups").select("*").order("display_order").order("created_at"),
      db.from("complement_items").select("*").order("display_order").order("created_at"),
      db.from("product_complement_groups").select("product_id, group_id"),
    ]);
    setGroups(g.data || []); setItems(i.data || []); setLinks(l.data || []);
  };
  useEffect(() => { load(); }, []);

  const fail = (e: any) => { if (e) toast({ title: "Erro", description: e.message, variant: "destructive" }); return !!e; };

  const addGroup = async () => {
    const { data, error } = await db.from("complement_groups")
      .insert({ name: "Novo grupo", min_select: 0, max_select: 1, display_order: groups.length }).select().single();
    if (fail(error)) return;
    setGroups([...groups, data]); setOpen(data.id);
  };
  const patchGroup = (id: string, patch: Partial<Group>) => setGroups(gs => gs.map(g => g.id === id ? { ...g, ...patch } : g));
  const saveGroup = async (id: string, patch: Partial<Group>) => {
    patchGroup(id, patch);
    fail((await db.from("complement_groups").update(patch).eq("id", id)).error);
  };
  const deleteGroup = async (id: string) => {
    if (!confirm("Excluir este grupo e todos os seus itens?")) return;
    if (fail((await db.from("complement_groups").delete().eq("id", id)).error)) return;
    setGroups(groups.filter(g => g.id !== id)); setItems(items.filter(i => i.group_id !== id));
    setLinks(links.filter(l => l.group_id !== id));
  };

  const addItem = async (groupId: string) => {
    const count = items.filter(i => i.group_id === groupId).length;
    const { data, error } = await db.from("complement_items")
      .insert({ group_id: groupId, name: "Novo item", price: 0, display_order: count }).select().single();
    if (fail(error)) return;
    setItems([...items, data]);
  };
  const patchItem = (id: string, patch: Partial<Item>) => setItems(is => is.map(i => i.id === id ? { ...i, ...patch } : i));
  const saveItem = async (id: string, patch: Partial<Item>) => {
    patchItem(id, patch);
    fail((await db.from("complement_items").update(patch).eq("id", id)).error);
  };
  const deleteItem = async (id: string) => {
    if (fail((await db.from("complement_items").delete().eq("id", id)).error)) return;
    setItems(items.filter(i => i.id !== id));
  };

  const toggleLink = async (groupId: string, productId: string, on: boolean) => {
    if (on) {
      if (fail((await db.from("product_complement_groups").insert({ group_id: groupId, product_id: productId })).error)) return;
      setLinks([...links, { group_id: groupId, product_id: productId }]);
    } else {
      if (fail((await db.from("product_complement_groups").delete().eq("group_id", groupId).eq("product_id", productId)).error)) return;
      setLinks(links.filter(l => !(l.group_id === groupId && l.product_id === productId)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4 border rounded-lg p-4 bg-card">
        <div>
          <h2 className="text-xl font-semibold">Grupos de complementos</h2>
          <p className="text-sm text-muted-foreground">Crie grupos reutilizáveis e vincule-os aos produtos.</p>
        </div>
        <Button onClick={addGroup}><Plus className="h-4 w-4 mr-2" />Novo grupo</Button>
      </div>

      {groups.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum grupo criado ainda.</p>}

      {groups.map(g => {
        const gItems = items.filter(i => i.group_id === g.id);
        const gLinks = links.filter(l => l.group_id === g.id).map(l => l.product_id);
        const linkedNames = products.filter(p => gLinks.includes(p.id)).map(p => p.name);
        const isOpen = open === g.id;
        return (
          <div key={g.id} className="border rounded-lg bg-card">
            <div className="flex items-center gap-3 p-4">
              <button onClick={() => setOpen(isOpen ? null : g.id)} className="flex-1 flex items-start gap-2 text-left">
                {isOpen ? <ChevronDown className="h-4 w-4 mt-1" /> : <ChevronRight className="h-4 w-4 mt-1" />}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{g.name}</span>
                    {g.required && <Badge variant="secondary">Obrigatório</Badge>}
                    <span className="text-xs text-muted-foreground">{gItems.length} itens</span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Seleção: {g.min_select}–{g.max_select} · <Link2 className="h-3 w-3" /> {gLinks.length} produto(s)
                  </p>
                </div>
              </button>
              <Switch checked={g.active} onCheckedChange={v => saveGroup(g.id, { active: v })} />
              <Button variant="ghost" size="icon" onClick={() => deleteGroup(g.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>

            {isOpen && (
              <div className="border-t p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div><Label>Nome do grupo</Label>
                    <Input value={g.name} onChange={e => patchGroup(g.id, { name: e.target.value })} onBlur={e => saveGroup(g.id, { name: e.target.value })} /></div>
                  <div><Label>Descrição</Label>
                    <Input placeholder="Opcional" value={g.description || ""} onChange={e => patchGroup(g.id, { description: e.target.value })} onBlur={e => saveGroup(g.id, { description: e.target.value || null })} /></div>
                  <div><Label>Mín. seleção</Label>
                    <Input type="number" min={0} value={g.min_select} onChange={e => patchGroup(g.id, { min_select: Number(e.target.value) })} onBlur={e => saveGroup(g.id, { min_select: Math.max(0, Number(e.target.value)) })} /></div>
                  <div><Label>Máx. seleção</Label>
                    <Input type="number" min={1} value={g.max_select} onChange={e => patchGroup(g.id, { max_select: Number(e.target.value) })} onBlur={e => saveGroup(g.id, { max_select: Math.max(1, Number(e.target.value)) })} /></div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={g.required} onCheckedChange={v => saveGroup(g.id, { required: v, min_select: v ? Math.max(1, g.min_select) : 0 })} />
                  <Label>Obrigatório</Label>
                </div>

                <div className="rounded-md bg-muted p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Produtos vinculados: {linkedNames.join(", ") || "nenhum"}</p>
                  <Input placeholder="Buscar produto para vincular..." value={productFilter} onChange={e => setProductFilter(e.target.value)} className="h-8" />
                  <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {products.filter(p => p.name.toLowerCase().includes(productFilter.toLowerCase())).map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={gLinks.includes(p.id)} onCheckedChange={v => toggleLink(g.id, p.id, !!v)} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <Label>Itens do grupo</Label>
                  <Button variant="outline" size="sm" onClick={() => addItem(g.id)}><Plus className="h-4 w-4 mr-1" />Adicionar item</Button>
                </div>
                <div className="space-y-2">
                  {gItems.map(i => (
                    <div key={i.id} className="border rounded-md p-3">
                      <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] items-center gap-3">
                        <ImageUpload
                          value={i.image_url}
                          onChange={url => saveItem(i.id, { image_url: url })}
                          label="Foto do item"
                          folder="complements"
                        />
                        <div className="space-y-1">
                          <Label htmlFor={`item-name-${i.id}`}>Nome</Label>
                          <Input id={`item-name-${i.id}`} value={i.name} onChange={e => patchItem(i.id, { name: e.target.value })} onBlur={e => saveItem(i.id, { name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-description-${i.id}`}>Descrição</Label>
                          <Input id={`item-description-${i.id}`} placeholder="Opcional" value={i.description || ""} onChange={e => patchItem(i.id, { description: e.target.value })} onBlur={e => saveItem(i.id, { description: e.target.value || null })} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-price-${i.id}`}>Preço</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">R$</span>
                            <Input id={`item-price-${i.id}`} className="w-24" type="number" step="0.01" min={0} value={i.price} onChange={e => patchItem(i.id, { price: Number(e.target.value) })} onBlur={e => saveItem(i.id, { price: Math.max(0, Number(e.target.value)) })} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch id={`item-active-${i.id}`} checked={i.active} onCheckedChange={v => saveItem(i.id, { active: v })} />
                          <Label htmlFor={`item-active-${i.id}`}>Ativo</Label>
                        </div>
                        <Button variant="ghost" size="icon" aria-label={`Excluir ${i.name}`} onClick={() => deleteItem(i.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {gItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
