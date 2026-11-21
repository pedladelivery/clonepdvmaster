import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getNameInitials } from "@/lib/nameInitials";
import { useStore } from "@/contexts/StoreContext";
import { fetchSellerIdsForStore } from "@/lib/sellerStores";

interface Seller {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  commission_rate: number;
  active: boolean;
}

interface SellerSelectorProps {
  selectedSeller: Seller | null;
  onSellerSelect: (seller: Seller | null) => void;
  disabled?: boolean;
}

export function SellerSelector({ selectedSeller, onSellerSelect, disabled }: SellerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  const { scopeStoreId, writeStoreId } = useStore();
  const storeId = scopeStoreId ?? writeStoreId;

  useEffect(() => {
    fetchSellers();
  }, [storeId]);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      let list = (data || []) as Seller[];
      if (storeId) {
        const ids = new Set(await fetchSellerIdsForStore(storeId));
        list = list.filter((s) => ids.has(s.id));
      }
      setSellers(list);
      if (selectedSeller && !list.some((s) => s.id === selectedSeller.id)) onSellerSelect(null);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-auto justify-start gap-3 hover:bg-accent/10 text-left"
          disabled={disabled}
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-lg flex-shrink-0">
              {selectedSeller ? (
                <span className="text-primary font-semibold">
                  {getNameInitials(selectedSeller.name)}
                </span>
              ) : (
                <User className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-foreground truncate">
                {selectedSeller ? selectedSeller.name : "Selecionar Vendedor"}
              </span>
              {selectedSeller && (
                <span className="text-xs text-muted-foreground">
                  Vendedor
                </span>
              )}
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar vendedor..." />
          <CommandList>
            <CommandEmpty>
              {loading ? "Carregando..." : "Nenhum vendedor encontrado."}
            </CommandEmpty>
            <CommandGroup>
              {sellers.map((seller) => (
                <CommandItem
                  key={seller.id}
                  value={seller.name}
                  onSelect={() => {
                    onSellerSelect(seller);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
                      <span className="text-primary font-semibold text-sm">
                        {getNameInitials(seller.name)}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium truncate">{seller.name}</span>
                      {seller.phone && (
                        <span className="text-xs text-muted-foreground">
                          {seller.phone}
                        </span>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        selectedSeller?.id === seller.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}