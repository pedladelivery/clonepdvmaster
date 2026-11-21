import { StorageImage } from "@/components/ui/StorageImage";
import { ShoppingCart, Menu, User, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { AdminPanel } from "./AdminPanel";
import { useTheme } from "@/contexts/ThemeContext";
import { getNameInitials } from "@/lib/nameInitials";
import { useStore } from "@/contexts/StoreContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Check } from "lucide-react";

interface Seller {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  commission_rate: number;
  active: boolean;
}

interface PDVHeaderProps {
  cartItemsCount: number;
  total: number;
  onMenuClick?: () => void;
  onCartClick?: () => void;
  onSaveOrderClick?: () => void;
  selectedSeller?: Seller | null;
}

export const PDVHeader = ({ cartItemsCount, total, onMenuClick, onCartClick, onSaveOrderClick, selectedSeller }: PDVHeaderProps) => {
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const { settings } = useTheme();
  const { activeStore, isSuperAdmin, scopeStoreId, allowedStores, setScopeStoreId } = useStore();
  const canSwitch = isSuperAdmin || allowedStores.length > 1;
  const storeLabel = isSuperAdmin && !scopeStoreId ? "TODAS" : activeStore?.name || null;

  // Cap sizes on mobile to prevent overflow
  const logoSize = settings.logo_size || 32;
  const menuIconSize = settings.menu_icon_size || 32;
  const cartIconSize = settings.cart_icon_size || 24;
  const saveIconSize = settings.save_icon_size || 24;
  const mobileIconSize = (size: number) => window.innerWidth < 640 ? Math.round(size * 0.8) : size;
  const storeNameSize = settings.store_name_size || 20;
  const subtitleSize = settings.subtitle_size || 12;

  return (
    <>
      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} />
      <header className="bg-gradient-primary text-primary-foreground shadow-medium sticky top-0 z-50">
        <div className="flex items-center justify-between px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 gap-2 w-full overflow-hidden">
          {/* Logo & Menu */}
          <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-shrink">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-primary-foreground hover:bg-primary-light flex-shrink-0 p-1.5 sm:p-2"
              onClick={onMenuClick || (() => setIsAdminPanelOpen(true))}
            >
              <Menu style={{ 
                width: (window.innerWidth < 640 ? Math.min(Math.round(menuIconSize*0.8), 48) : menuIconSize), 
                height: (window.innerWidth < 640 ? Math.min(Math.round(menuIconSize*0.8), 48) : menuIconSize) 
              }} />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              {settings.logo_url && (
                <StorageImage 
                  src={settings.logo_url} 
                  alt="Logo" 
                  style={{ 
                    width: (window.innerWidth < 640 ? Math.min(Math.round(logoSize*0.8), 64) : logoSize), 
                    height: (window.innerWidth < 640 ? Math.min(Math.round(logoSize*0.8), 64) : logoSize) 
                  }}
                  className="object-contain flex-shrink-0"
                />
              )}
              <div className="min-w-0 max-w-[140px] sm:max-w-none">
                <h1 
                  style={{ fontSize: (window.innerWidth < 640 ? Math.min(Math.round(storeNameSize*0.75), 24) : storeNameSize) }} 
                  className="font-bold truncate leading-tight"
                >
                  {settings.store_name || 'RestaurPOS'}
                </h1>
                {storeLabel && canSwitch ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        style={{ fontSize: (window.innerWidth < 640 ? Math.min(Math.round(subtitleSize*0.8), 18) : subtitleSize) }}
                        className="w-full min-w-0 opacity-90 leading-tight flex items-center gap-0.5 sm:gap-1 underline-offset-2 hover:underline"
                        aria-label="Trocar loja"
                      >
                        <span className="hidden sm:inline">Loja:&nbsp;</span>
                        <span className="truncate">{storeLabel}</span>
                        <ChevronDown className="h-3 w-3 flex-shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="z-[60]">
                      <DropdownMenuLabel>Trocar loja</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isSuperAdmin && (
                        <DropdownMenuItem onClick={() => setScopeStoreId(null)}>
                          {!scopeStoreId ? <Check className="h-4 w-4 mr-2" /> : <span className="w-4 mr-2" />}
                          Todas as lojas
                        </DropdownMenuItem>
                      )}
                      {allowedStores.map((s) => (
                        <DropdownMenuItem key={s.id} onClick={() => setScopeStoreId(s.id)}>
                          {activeStore?.id === s.id && (scopeStoreId || !isSuperAdmin) ? <Check className="h-4 w-4 mr-2" /> : <span className="w-4 mr-2" />}
                          {s.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                <p 
                  style={{ fontSize: (window.innerWidth < 640 ? Math.min(Math.round(subtitleSize*0.8), 18) : subtitleSize) }} 
                  className="opacity-90 truncate leading-tight"
                >
                  {storeLabel ? `Loja: ${storeLabel}` : (settings.subtitle_text || 'Sistema de Vendas')}
                </p>
                )}
              </div>
            </div>
          </div>

          {/* Cart Summary */}
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <div className="text-right hidden md:block">
              <p className="text-xs opacity-90">Total do Carrinho</p>
              <p className="text-sm font-bold">R$ {total.toFixed(2)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="relative h-auto min-h-9 text-primary-foreground hover:bg-primary-light hover:text-primary-foreground p-1.5 sm:p-2"
              title="Carrinho"
              aria-label="Carrinho"
              onClick={onCartClick}
            >
              <ShoppingCart style={{ width: mobileIconSize(cartIconSize), height: mobileIconSize(cartIconSize) }} />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-warning text-warning-foreground text-[10px] rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center font-bold">
                  {cartItemsCount}
                </span>
              )}
            </Button>
            {onSaveOrderClick && (
              <Button
                variant="ghost"
                size="sm"
                title="Salvar pedido"
                aria-label="Salvar pedido"
                className="h-auto min-h-9 text-primary-foreground hover:bg-primary-light hover:text-primary-foreground p-1.5 sm:p-2 disabled:opacity-50"
                onClick={onSaveOrderClick}
                disabled={cartItemsCount === 0}
              >
                <Save style={{ width: mobileIconSize(saveIconSize), height: mobileIconSize(saveIconSize) }} />
              </Button>
            )}
          </div>

          {/* Seller Info */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div className="text-right hidden lg:block">
              <p className="text-xs font-medium">Vendedor</p>
              <p className="text-[10px] opacity-90">
                {selectedSeller ? selectedSeller.name : "Sem vendedor"}
              </p>
            </div>
            <div className="bg-primary-light rounded-full p-1.5 sm:p-2 min-w-[28px] sm:min-w-[32px] flex items-center justify-center">
              {selectedSeller ? (
                <span className="text-xs sm:text-sm font-bold">
                  {getNameInitials(selectedSeller.name)}
                </span>
              ) : (
                <User className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};
