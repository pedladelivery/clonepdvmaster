import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { splitItemNote, buildItemNote } from "@/lib/itemNotes";
import { Textarea } from "@/components/ui/textarea";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

interface SaveOrderDialogProps {
  open: boolean;
  items?: OrderItem[];
  onOpenChange: (open: boolean) => void;
  onSave: (customerName: string, shouldOverwrite: boolean, existingSaleId?: string, shouldPrint?: boolean, notes?: string, itemNotes?: Record<string, string>) => void;
  loadedSaleId?: string | null;
  loadedCustomerName?: string;
  loadedNotes?: string;
  initialItemNotes?: Record<string, string>;
}

export const SaveOrderDialog = ({ open, items = [], onOpenChange, onSave, loadedSaleId, loadedCustomerName, loadedNotes, initialItemNotes }: SaveOrderDialogProps) => {
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [existingSaleId, setExistingSaleId] = useState("");
  const [shouldPrint, setShouldPrint] = useState(false);
  const { toast } = useToast();
  const { scopeStoreId } = useStore();

  useEffect(() => {
    if (!open) {
      setCustomerName("");
      setNotes("");
      setItemNotes({});
      setShowDuplicateDialog(false);
      setExistingSaleId("");
    } else {
      if (loadedCustomerName) setCustomerName(loadedCustomerName);
      setNotes(loadedNotes || "");
      setItemNotes(initialItemNotes || {});
    }
  }, [open, loadedCustomerName, loadedNotes, initialItemNotes]);

  const buildNotes = () => notes.trim();

  const buildItemNotes = () => {
    const result: Record<string, string> = {};
    items.forEach((item) => {
      const note = (itemNotes[item.id] || "").trim();
      if (note) result[item.id] = note;
    });
    return result;
  };

  const checkForDuplicate = async (name: string) => {
    try {
      const demoUserId = "00000000-0000-0000-0000-000000000000";
      
      let q = supabase
        .from('sales')
        .select('id, customer_name')
        .eq('status', 'pending')
        .eq('user_id', demoUserId)
        .ilike('customer_name', name.trim());
      if (scopeStoreId) q = q.eq('store_id', scopeStoreId);
      const { data, error } = await q;

      if (error) throw error;
      
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error checking for duplicate:', error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, digite o nome do cliente",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const existingSale = await checkForDuplicate(customerName);
      
      if (existingSale && existingSale.id !== loadedSaleId) {
        setExistingSaleId(existingSale.id);
        setShowDuplicateDialog(true);
        setIsLoading(false);
        return;
      }

      // If this is the same loaded order or no duplicate found
      if (loadedSaleId) {
        // Update existing loaded order
        onSave(customerName.trim(), true, loadedSaleId, shouldPrint, buildNotes(), buildItemNotes());
      } else {
        // Create new order
        onSave(customerName.trim(), false, undefined, shouldPrint, buildNotes(), buildItemNotes());
      }
      onOpenChange(false);

    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar duplicatas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverwrite = () => {
    onSave(customerName.trim(), true, existingSaleId, shouldPrint, buildNotes(), buildItemNotes());
    setShowDuplicateDialog(false);
    onOpenChange(false);
  };

  const handleCreateNew = () => {
    const timestamp = new Date().toLocaleString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const newName = `${customerName.trim()} (${timestamp})`;
    onSave(newName, false, undefined, shouldPrint, buildNotes(), buildItemNotes());
    setShowDuplicateDialog(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {loadedSaleId ? "Atualizar Pedido em Aberto" : "Salvar Pedido em Aberto"}
            </DialogTitle>
            <DialogDescription>
              {loadedSaleId 
                ? "Modifique o nome do cliente ou mantenha para atualizar o pedido existente."
                : "Digite o nome do cliente para salvar este pedido."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customer-name" className="text-right">
                Nome do Cliente
              </Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="col-span-3"
                placeholder="Digite o nome do cliente"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSave();
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="order-notes">Observações</Label>
              <Textarea
                id="order-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: sem cebola, entregar às 20h, mesa 5..."
                rows={3}
              />
            </div>
            {items.length > 0 && (
              <div className="grid gap-2">
                <Label>Observações por item</Label>
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-md border border-border p-2 space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        {item.quantity}x {item.name}
                      </p>
                      {(() => {
                        const { complementLines, obs } = splitItemNote(itemNotes[item.id] || "");
                        return (
                          <>
                            {complementLines.length > 0 && (
                              <div className="rounded-md border bg-muted/40 px-2 py-1 space-y-0.5">
                                {complementLines.map((line, idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground leading-snug">+ {line}</p>
                                ))}
                              </div>
                            )}
                            <Input
                              value={obs}
                              onChange={(e) =>
                                setItemNotes((prev) => ({ ...prev, [item.id]: buildItemNote(complementLines, e.target.value) }))
                              }
                              placeholder="Ex.: sem cebola, bem passado..."
                              className="h-8 text-sm"
                            />
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2 pl-4">
              <input
                type="checkbox"
                id="shouldPrint"
                checked={shouldPrint}
                onChange={(e) => setShouldPrint(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <Label htmlFor="shouldPrint" className="flex items-center gap-2 cursor-pointer">
                <Printer className="h-4 w-4" />
                <span>Imprimir comanda após salvar</span>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isLoading || !customerName.trim()}
            >
              {isLoading 
                ? "Verificando..." 
                : loadedSaleId 
                  ? "Atualizar Pedido" 
                  : "Salvar Pedido"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente já possui pedido em aberto</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um pedido em aberto para "{customerName}". 
              Você pode sobrescrever o pedido existente ou criar um novo com nome diferenciado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowDuplicateDialog(false)}>
              Cancelar
            </AlertDialogCancel>
            {loadedSaleId && (
              <Button
                variant="outline"
                onClick={() => {
                  // Update current loaded order
                  onSave(customerName.trim(), true, loadedSaleId, shouldPrint, buildNotes(), buildItemNotes());
                  setShowDuplicateDialog(false);
                  onOpenChange(false);
                }}
                className="w-full sm:w-auto"
              >
                Atualizar Pedido Atual
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleCreateNew}
              className="w-full sm:w-auto"
            >
              Salvar como Novo
            </Button>
            <AlertDialogAction onClick={handleOverwrite}>
              Sobrescrever Existente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};