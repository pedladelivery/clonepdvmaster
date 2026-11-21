import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Percent, DollarSign, Plus, Minus } from "lucide-react";
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

interface ExpandableCartPanelProps {
  items: CartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  discount: { type: "value" | "percent"; amount: number };
  surcharge: { type: "value" | "percent"; amount: number };
  onDiscountChange: (discount: { type: "value" | "percent"; amount: number }) => void;
  onSurchargeChange: (surcharge: { type: "value" | "percent"; amount: number }) => void;
  subtotal: number;
  finalTotal: number;
  itemNotes?: Record<string, string>;
  onItemNoteChange?: (id: string, note: string) => void;
  /** Abre a tela de complementos/observação para editar o item. */
  onEditItem?: (item: CartItem) => void;
}

export const ExpandableCartPanel = ({
  items,
  onRemoveItem,
  onUpdateQuantity,
  discount,
  surcharge,
  onDiscountChange,
  onSurchargeChange,
  subtotal,
  finalTotal,
  itemNotes = {},
  onItemNoteChange,
  onEditItem,
}: ExpandableCartPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showSurcharge, setShowSurcharge] = useState(false);

  if (items.length === 0) return null;

  const discountValue =
    discount.type === "percent"
      ? (subtotal * discount.amount) / 100
      : discount.amount;

  const surchargeValue =
    surcharge.type === "percent"
      ? (subtotal * surcharge.amount) / 100
      : surcharge.amount;

  return (
    <div className="bg-card border-b border-border w-full">
      {/* Toggle bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 sm:px-6 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {items.reduce((s, i) => s + i.quantity, 0)} produto(s)
          </span>
          <span>•</span>
          <span>Total: <strong className="text-foreground">R$ {finalTotal.toFixed(2)}</strong></span>
          {discountValue > 0 && (
            <span className="text-green-600 text-xs">(-R$ {discountValue.toFixed(2)})</span>
          )}
          {surchargeValue > 0 && (
            <span className="text-orange-600 text-xs">(+R$ {surchargeValue.toFixed(2)})</span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="px-3 sm:px-6 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          {/* Items list */}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {items.map((item) => {
              const { complementLines, obs } = splitItemNote(itemNotes[item.id] || "");
              return (
              <div
                key={item.id}
                className="py-2 px-2 sm:px-3 rounded-lg bg-background border border-border space-y-2"
              >
              <div className="flex items-center gap-2">
                {onEditItem ? (
                  <button
                    type="button"
                    onClick={() => onEditItem(item)}
                    title="Toque para editar complementos e observação"
                    className="flex-1 min-w-0 text-left rounded-md hover:bg-muted/60 transition-colors"
                  >
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      R$ {item.price.toFixed(2)} un. — toque para editar
                    </p>
                  </button>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      R$ {item.price.toFixed(2)} un.
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 sm:h-7 sm:w-7 p-0"
                    onClick={() =>
                      item.quantity > 1
                        ? onUpdateQuantity(item.id, item.quantity - 1)
                        : onRemoveItem(item.id)
                    }
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs sm:text-sm font-semibold w-5 sm:w-6 text-center text-foreground">
                    {item.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 sm:h-7 sm:w-7 p-0"
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs sm:text-sm font-semibold w-14 sm:w-20 text-right text-foreground">
                    R$ {(item.price * item.quantity).toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                </div>
              </div>
              {complementLines.length > 0 && (
                <div className="rounded-md border bg-muted/40 px-2 py-1.5 space-y-0.5">
                  {complementLines.map((line, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground leading-snug">+ {line}</p>
                  ))}
                </div>
              )}
              <Input
                value={obs}
                onChange={(e) => onItemNoteChange?.(item.id, buildItemNote(complementLines, e.target.value))}
                placeholder="Observação do item (ex.: sem cebola)"
                className="h-8 text-xs"
              />
              </div>
              );
            })}
          </div>

          {/* Discount & Surcharge buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={showDiscount ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowDiscount(!showDiscount);
                setShowSurcharge(false);
              }}
              className="text-xs"
            >
              <Percent className="h-3.5 w-3.5 mr-1" />
              Desconto
            </Button>
            <Button
              variant={showSurcharge ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowSurcharge(!showSurcharge);
                setShowDiscount(false);
              }}
              className="text-xs"
            >
              <DollarSign className="h-3.5 w-3.5 mr-1" />
              Acréscimo
            </Button>
          </div>

          {/* Discount input */}
          {showDiscount && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <span className="text-sm font-medium text-green-700 dark:text-green-400 flex-shrink-0">
                Desconto:
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant={discount.type === "value" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => onDiscountChange({ ...discount, type: "value" })}
                >
                  R$
                </Button>
                <Button
                  variant={discount.type === "percent" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => onDiscountChange({ ...discount, type: "percent" })}
                >
                  %
                </Button>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discount.amount || ""}
                onChange={(e) =>
                  onDiscountChange({
                    ...discount,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-8 w-24 text-sm"
                placeholder="0,00"
              />
              {discount.amount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() => onDiscountChange({ type: "value", amount: 0 })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {/* Surcharge input */}
          {showSurcharge && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400 flex-shrink-0">
                Acréscimo:
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant={surcharge.type === "value" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => onSurchargeChange({ ...surcharge, type: "value" })}
                >
                  R$
                </Button>
                <Button
                  variant={surcharge.type === "percent" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => onSurchargeChange({ ...surcharge, type: "percent" })}
                >
                  %
                </Button>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={surcharge.amount || ""}
                onChange={(e) =>
                  onSurchargeChange({
                    ...surcharge,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-8 w-24 text-sm"
                placeholder="0,00"
              />
              {surcharge.amount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() => onSurchargeChange({ type: "value", amount: 0 })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {/* Totals summary */}
          <div className="border-t border-border pt-3 space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>
                  Desconto{" "}
                  {discount.type === "percent" ? `(${discount.amount}%)` : ""}
                </span>
                <span>- R$ {discountValue.toFixed(2)}</span>
              </div>
            )}
            {surchargeValue > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>
                  Acréscimo{" "}
                  {surcharge.type === "percent" ? `(${surcharge.amount}%)` : ""}
                </span>
                <span>+ R$ {surchargeValue.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-foreground">
              <span>Total</span>
              <span>R$ {finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
