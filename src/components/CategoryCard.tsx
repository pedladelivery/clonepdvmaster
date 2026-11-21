import { StorageImage } from "@/components/ui/StorageImage";
import { useTheme } from "@/contexts/ThemeContext";

interface CategoryCardProps {
  name: string;
  image: string;
  isActive: boolean;
  onClick: () => void;
}

export const CategoryCard = ({ name, image, isActive, onClick }: CategoryCardProps) => {
  const { settings } = useTheme();
  return (
    <div
      className={`
         w-full min-w-0 cursor-pointer rounded-xl overflow-hidden shadow-soft transition-smooth bg-card
        ${isActive 
          ? 'ring-2 ring-secondary' 
          : 'hover:shadow-medium hover:scale-105'
        }
      `}
      onClick={onClick}
    >
      <div className="aspect-square overflow-hidden">
        <StorageImage 
          src={image} 
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
      <div
        className="p-2 sm:p-4"
        style={{ backgroundColor: settings.category_name_bg }}
      >
        <h3
           className="font-bold text-center break-words [overflow-wrap:anywhere]"
          style={{
            fontSize: `${settings.category_name_size}px`,
            color: isActive ? undefined : settings.category_name_color,
          }}
        >
          <span className={isActive ? 'text-secondary' : ''}>{name}</span>
        </h3>
      </div>
    </div>
  );
};
