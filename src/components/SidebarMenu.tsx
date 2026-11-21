import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  Users, 
  FileText, 
  TrendingUp, 
  RotateCcw, 
  Warehouse, 
  DollarSign, 
  BarChart3, 
  Settings,
  ShoppingCart,
  UserPlus,
  Truck,
  LogOut,
  CreditCard
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import type { AreaKey } from "@/lib/permissions";

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

export const SidebarMenu = ({ isOpen, onClose, onNavigate }: SidebarMenuProps) => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { can, loading } = usePermissions();

  const allMenuItems: { id: AreaKey; label: string; icon: typeof Package }[] = [
    { id: "catalog", label: "Catálogo", icon: Package },
    { id: "customers", label: "Clientes", icon: Users },
    { id: "suppliers", label: "Fornecedores", icon: Truck },
    { id: "sellers", label: "Vendedores", icon: UserPlus },
    { id: "pending-sales", label: "Vendas em Aberto", icon: FileText },
    { id: "sales", label: "Vendas", icon: TrendingUp },
    { id: "returns", label: "Devoluções", icon: RotateCcw },
    { id: "stock", label: "Estoque", icon: Warehouse },
    { id: "financial", label: "Financeiro", icon: DollarSign },
    { id: "reports", label: "Relatórios", icon: BarChart3 },
    { id: "settings", label: "Configurações", icon: Settings },
    { id: "subscription", label: "Minha Assinatura", icon: CreditCard },
  ];

  const menuItems = loading ? [] : allMenuItems.filter((item) => can(item.id));

  const handleItemClick = (itemId: string) => {
    onNavigate(itemId);
    onClose();
  };

  const handleLogout = async () => {
    await signOut();
    toast({ title: "Desconectado", description: "Você saiu do sistema." });
    onClose();
    // Força navegação para a tela de login (importante no PWA standalone)
    window.location.replace("/auth");
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Menu Principal
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-2">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className="w-full justify-start h-12 text-left"
              onClick={() => handleItemClick(item.id)}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.label}
            </Button>
          ))}
          
          <Separator className="my-3" />
          
          <Button
            variant="ghost"
            className="w-full justify-start h-12 text-left text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};


