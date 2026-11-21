import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';

export const InstallPWABanner = () => {
  const { isInstallable, installApp, isStandalone, isIOS, showIOSInstall, dismissIOSInstall } = usePWA();
  const [showAndroid, setShowAndroid] = useState(false);

  useEffect(() => {
    if (isStandalone || !isInstallable) return;

    const dismissed = localStorage.getItem('install-banner-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const timer = setTimeout(() => setShowAndroid(true), 3000);
    return () => clearTimeout(timer);
  }, [isInstallable, isStandalone]);

  const handleInstall = async () => {
    const accepted = await installApp();
    if (accepted) {
      setShowAndroid(false);
    }
  };

  const handleDismissAndroid = () => {
    setShowAndroid(false);
    localStorage.setItem('install-banner-dismissed', Date.now().toString());
  };

  if (isStandalone) return null;

  // iOS instruction banner
  if (showIOSInstall && isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-lg max-w-sm mx-auto">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Share className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Instalar Aplicativo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Toque em <strong>Compartilhar</strong> <Share className="inline w-3 h-3" /> e depois em <strong>"Adicionar à Tela de Início"</strong>
              </p>
            </div>
            <button
              onClick={dismissIOSInstall}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop install button
  if (showAndroid && isInstallable) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleInstall}
            className="rounded-full shadow-lg px-5 py-3 h-auto gap-2 text-sm font-semibold"
            size="lg"
          >
            <Download className="w-4 h-4" />
            Instalar App
          </Button>
          <button
            onClick={handleDismissAndroid}
            className="w-8 h-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
