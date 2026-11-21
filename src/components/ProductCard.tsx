import { StorageImage } from "@/components/ui/StorageImage";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

interface ProductCardProps {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  onAddToCart: (product: any) => void;
}

export const ProductCard = ({ id, name, description, price, image, onAddToCart }: ProductCardProps) => {
  const { settings } = useTheme();
  const handleAddToCart = () => {
    onAddToCart({ id, name, description, price, image });
  };

  return (
    <div className="w-full min-w-0 bg-card rounded-xl shadow-soft hover:shadow-medium transition-smooth hover:bg-product-hover cursor-pointer group @container">
      <div className="aspect-square overflow-hidden rounded-t-xl">
        <StorageImage 
          src={image} 
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
        />
      </div>
      <div
        className="p-2 sm:p-4 rounded-b-xl"
        style={{ backgroundColor: settings.product_name_bg, textAlign: settings.product_label_align }}
      >
        <h3
          className="font-bold mb-1 line-clamp-1"
          style={{
            fontSize: `${settings.product_name_size}px`,
            color: settings.product_name_color,
          }}
        >
          {name}
        </h3>
        <p className="text-xs text-muted-foreground mb-2 sm:mb-3 line-clamp-2 hidden sm:block">{description}</p>
        <div className={`flex flex-wrap items-center gap-1 ${settings.product_label_align === "center" ? "flex-col justify-center" : settings.product_label_align === "right" ? "justify-end" : "justify-between"}`}>
          <span className="text-xs sm:text-lg font-bold text-secondary break-all">R$ {price.toFixed(2)}</span>
          <Button 
            size="sm" 
            className="bg-gradient-success hover:bg-success-light transition-bounce h-7 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
            onClick={handleAddToCart}
            aria-label={`Adicionar ${name}`}
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
