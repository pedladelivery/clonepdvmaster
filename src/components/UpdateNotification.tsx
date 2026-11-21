import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';

export const UpdateNotification = () => {
  const { updateAvailable, applyUpdate } = usePWA();

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
        <RefreshCw className="w-4 h-4 text-primary animate-spin" />
        <span className="text-sm text-foreground font-medium">Nova versão disponível</span>
        <Button size="sm" onClick={applyUpdate} className="h-7 text-xs">
          Atualizar
        </Button>
      </div>
    </div>
  );
};
