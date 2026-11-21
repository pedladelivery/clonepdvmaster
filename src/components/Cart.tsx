import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CartItemComponent } from "./CartItem";
import { CreditCard, Clock, Printer } from "lucide-react";
import { SaveOrderDialog } from "@/components/ui/SaveOrderDialog";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
  onSaveForLater: (customerName: string, shouldOverwrite: boolean, existingSaleId?: string, shouldPrint?: boolean, notes?: string, itemNotes?: Record<string, string>) => void;
  onPrintReceipt?: () => void;
  loadedSaleId?: string | null;
  loadedCustomerName?: string;
  loadedNotes?: string;
  itemNotes?: Record<string, string>;
  onItemNoteChange?: (id: string, note: string) => void;
  /** Abre a tela de complementos/observação para editar o item. */
  onEditItem?: (item: CartItem) => void;
}

export const Cart = ({ items, onUpdateQuantity, onRemoveItem, onCheckout, onSaveForLater, onPrintReceipt, loadedSaleId, loadedCustomerName, loadedNotes, itemNotes = {}, onItemNoteChange, onEditItem }: CartProps) => {

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSaveOrder = (customerName: string, shouldOverwrite: boolean, existingSaleId?: string, shouldPrint?: boolean, notes?: string, savedItemNotes?: Record<string, string>) => {
    onSaveForLater(customerName, shouldOverwrite, existingSaleId, shouldPrint, notes, savedItemNotes);
    setShowSaveDialog(false);
  };

  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Carrinho</h2>
          <p className="text-sm text-muted-foreground">0 itens</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Carrinho vazio</p>
            <p className="text-sm text-muted-foreground">Adicione produtos para começar</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Carrinho</h2>
        <p className="text-sm text-muted-foreground">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</p>
        {loadedSaleId && (
          <div className="mt-2 p-2 bg-accent/20 rounded-md">
            <p className="text-xs text-accent-foreground">
              📝 Editando pedido de: {loadedCustomerName}
            </p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.map((item) => (
          <CartItemComponent
            key={item.id}
            item={item}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemoveItem}
            note={itemNotes[item.id] || ""}
            onNoteChange={onItemNoteChange}
            onEdit={onEditItem}
          />
        ))}

      </div>

      {/* Footer */}
      <div className="border-t border-border p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg">
            <span>Total</span>
            <span className="text-primary">R$ {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button 
            className="w-full bg-gradient-success hover:bg-success-light transition-bounce"
            onClick={onCheckout}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Finalizar Venda
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setShowSaveDialog(true)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Salvar Pedido
          </Button>
          {onPrintReceipt && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={onPrintReceipt}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Comanda
            </Button>
          )}
        </div>
      </div>
      
      <SaveOrderDialog
        open={showSaveDialog}
        items={items}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveOrder}
        loadedSaleId={loadedSaleId}
        loadedCustomerName={loadedCustomerName}
        loadedNotes={loadedNotes}
        initialItemNotes={itemNotes}
      />
    </div>
  );
};