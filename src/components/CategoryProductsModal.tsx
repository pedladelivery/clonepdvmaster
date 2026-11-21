import { StorageImage } from "@/components/ui/StorageImage";
import { useState, useMemo } from "react";
import { X, ArrowLeft, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogGrid } from "@/components/CatalogGrid";
import { Input } from "@/components/ui/input";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { useTheme } from "@/contexts/ThemeContext";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  image_url?: string;
  display_order: number;
}

interface CategoryProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  products: Product[];
  onAddToCart: (product: any) => void;
}

export const CategoryProductsModal = ({
  isOpen,
  onClose,
  categoryName,
  products,
  onAddToCart,
}: CategoryProductsModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { settings } = useTheme();

  // Botão "voltar" do celular fecha a janela em vez de sair do sistema
  useBackButtonClose(isOpen, onClose);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAdd = (product: Product) => {
    onAddToCart({
      id: product.id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      image: product.image_url || "/placeholder.svg",
    });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div className="bg-card w-[96%] h-[92%] rounded-2xl flex flex-col overflow-hidden shadow-large animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground">{categoryName}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Nenhum produto encontrado
            </div>
          ) : (
            <CatalogGrid kind="product">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="min-w-0 bg-background rounded-xl shadow-soft overflow-hidden flex flex-col cursor-pointer group hover:shadow-medium transition-smooth"
                  onClick={() => handleAdd(product)}
                >
                  <div className="aspect-square overflow-hidden">
                    <StorageImage
                      src={product.image_url || "/placeholder.svg"}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
                      loading="lazy"
                    />
                  </div>
                  <div
                    className={`p-2 flex flex-col gap-1 flex-1 ${settings.product_label_align === "center" ? "items-center" : settings.product_label_align === "right" ? "items-end" : "items-start"}`}
                    style={{ backgroundColor: settings.product_name_bg, textAlign: settings.product_label_align }}
                  >
                    <h3
                      className="font-bold line-clamp-2 leading-tight"
                      style={{
                        fontSize: `${settings.product_name_size}px`,
                        color: settings.product_name_color,
                      }}
                    >
                      {product.name}
                    </h3>
                    <span className="text-xs sm:text-base font-bold text-secondary break-all">
                      R${product.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </CatalogGrid>
          )}
        </div>
      </div>
    </div>
  );
};
