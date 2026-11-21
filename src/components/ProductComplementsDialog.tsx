import { StorageImage } from "@/components/ui/StorageImage";
import { useEffect, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildItemNote } from "@/lib/itemNotes";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";

export interface ComplementGroupFull {
  id: string; name: string; description: string | null; min_select: number; max_select: number; required: boolean;
  items: { id: string; name: string; description: string | null; price: number; image_url: string | null }[];
}

interface Props {
  product: { id: string; name: string; description?: string; price: number; image: string } | null;
  groups: ComplementGroupFull[];
  onClose: () => void;
  onConfirm: (extraPrice: number, note: string) => void;
  /** Ao editar um item já no carrinho: quantidades e observação atuais. */
  initialQuantities?: Record<string, number>;
  initialObs?: string;
  confirmLabel?: string;
}

export const ProductComplementsDialog = ({ product, groups, onClose, onConfirm, initialQuantities, initialObs, confirmLabel }: Props) => {
  const [qty, setQty] = useState<Record<string, number>>(initialQuantities || {});
  const [obs, setObs] = useState(initialObs || "");

  // Botão "voltar" do celular fecha a janela em vez de sair do sistema
  useBackButtonClose(!!product, onClose);

  useEffect(() => { setQty(initialQuantities || {}); setObs(initialObs || ""); }, [product?.id]);
  if (!product) return null;

  const groupCount = (g: ComplementGroupFull) => g.items.reduce((s, i) => s + (qty[i.id] || 0), 0);
  const change = (g: ComplementGroupFull, itemId: string, d: number) => {
    const cur = qty[itemId] || 0;
    if (d > 0 && groupCount(g) >= g.max_select) return;
    setQty({ ...qty, [itemId]: Math.max(0, cur + d) });
  };
  const minOf = (g: ComplementGroupFull) => Math.max(g.min_select, g.required ? 1 : 0);
  const missing = groups.filter(g => groupCount(g) < minOf(g));
  const extra = groups.flatMap(g => g.items).reduce((s, i) => s + (qty[i.id] || 0) * Number(i.price), 0);
  const total = product.price + extra;

  const confirm = () => {
    // Uma linha por item, sempre com o nome do grupo antes.
    const lines = groups.flatMap(g =>
      g.items.filter(i => qty[i.id]).map(i => `${g.name}: ${qty[i.id]}x ${i.name}`)
    );
    onConfirm(extra, buildItemNote(lines, obs.trim()));
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card w-[96%] max-w-md max-h-[92vh] rounded-2xl flex flex-col overflow-hidden shadow-large animate-scale-in">
        <div className="overflow-y-auto flex-1">
          <div className="relative">
            <StorageImage src={product.image || "/placeholder.svg"} alt={product.name} className="w-full h-48 object-cover" />
            <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-8 w-8 rounded-full" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="p-4 space-y-1">
            <h2 className="text-lg font-bold uppercase text-foreground">{product.name}</h2>
            {product.description && <p className="text-xs text-muted-foreground">{product.description}</p>}
            <p className="font-bold text-primary">R$ {product.price.toFixed(2)}</p>
          </div>

          {groups.map(g => (
            <div key={g.id} className="px-4 pb-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-sm font-bold uppercase">{g.name}</h3>
                  {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                </div>
                <div className="text-right">
                  {minOf(g) > 0 && <span className="text-[10px] font-semibold bg-primary text-primary-foreground rounded px-1.5 py-0.5 mr-1">Obrigatório</span>}
                  <span className="text-xs text-muted-foreground">{groupCount(g)}/{g.max_select}</span>
                </div>
              </div>
              <div className="space-y-2">
                {g.items.map(i => {
                  const q = qty[i.id] || 0;
                  return (
                    <div key={i.id} className="flex items-center gap-2 border rounded-lg p-2">
                      {i.image_url && <StorageImage src={i.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{i.name}</p>
                        {i.description && <p className="text-xs text-muted-foreground">{i.description}</p>}
                      </div>
                      {Number(i.price) > 0 && <span className="text-xs font-semibold whitespace-nowrap">+R$ {Number(i.price).toFixed(2)}</span>}
                      <Button size="icon" variant="outline" className="h-7 w-7 rounded-full" disabled={q === 0} onClick={() => change(g, i.id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-5 text-center text-sm font-semibold">{q}</span>
                      <Button size="icon" className="h-7 w-7 rounded-full" disabled={groupCount(g) >= g.max_select} onClick={() => change(g, i.id, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="px-4 pb-4">
            <h3 className="text-sm font-bold uppercase mb-2">Observações</h3>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: sem cebola, bem passado..." rows={2} />
          </div>
        </div>
        <div className="border-t p-3">
          <Button className="w-full" disabled={missing.length > 0} onClick={confirm}>
            {missing.length > 0 ? `Escolha: ${missing[0].name}` : `${confirmLabel || "Adicionar"} • R$ ${total.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
