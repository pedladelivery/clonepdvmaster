import { StorageImage } from "@/components/ui/StorageImage";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { splitItemNote, buildItemNote } from "@/lib/itemNotes";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartItemProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  note?: string;
  onNoteChange?: (id: string, note: string) => void;
  /** Abre a tela de complementos/observação para editar o item. */
  onEdit?: (item: CartItem) => void;
}

export const CartItemComponent = ({ item, onUpdateQuantity, onRemove, note = "", onNoteChange, onEdit }: CartItemProps) => {
  const { complementLines, obs } = splitItemNote(note);
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity <= 0) {
      onRemove(item.id);
    } else {
      onUpdateQuantity(item.id, newQuantity);
    }
  };


  return (
    <div className="p-3 bg-cart-bg rounded-lg shadow-soft space-y-2">
      <div className="flex items-center gap-3">
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(item)}
            title="Toque para editar complementos e observação"
            className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-md hover:bg-muted/60 transition-colors"
          >
            <StorageImage
              src={item.image}
              alt={item.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{item.name}</h4>
              <p className="text-primary font-semibold">R$ {item.price.toFixed(2)}</p>
            </div>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </button>
        ) : (
          <>
            <StorageImage
              src={item.image}
              alt={item.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{item.name}</h4>
              <p className="text-primary font-semibold">R$ {item.price.toFixed(2)}</p>
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleQuantityChange(item.quantity - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center font-medium">{item.quantity}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleQuantityChange(item.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 w-8 p-0 ml-1"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {onNoteChange && (
        <>
          {complementLines.length > 0 && (
            <div className="rounded-md border bg-muted/40 px-2 py-1.5 space-y-0.5">
              {complementLines.map((line, idx) => (
                <p key={idx} className="text-xs text-muted-foreground leading-snug">+ {line}</p>
              ))}
            </div>
          )}
          <Input
            value={obs}
            onChange={(e) => onNoteChange(item.id, buildItemNote(complementLines, e.target.value))}
            placeholder="Observação do item (ex.: sem cebola)"
            className="h-8 text-xs"
          />
        </>
      )}
    </div>

  );
};