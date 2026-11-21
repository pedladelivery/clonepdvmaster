import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

interface BackToMainButtonProps {
  onBackToMain: () => void;
}

export const BackToMainButton = ({ onBackToMain }: BackToMainButtonProps) => {
  return (
    <Button
      variant="outline"
      onClick={onBackToMain}
      className="mb-4"
    >
      <Home className="h-4 w-4 mr-2" />
      Voltar ao Menu Principal
    </Button>
  );
};