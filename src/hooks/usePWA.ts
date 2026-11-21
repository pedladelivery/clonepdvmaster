import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com');

export const usePWA = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Detect standalone mode
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    // Show iOS install prompt if not standalone and not dismissed recently
    if (ios && !standalone) {
      const dismissed = localStorage.getItem('ios-install-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        setTimeout(() => setShowIOSInstall(true), 3000);
      }
    }

    // Don't register SW in iframe/preview
    if (isInIframe || isPreviewHost) return;

    const setupServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return;

      try {
        const resetKey = 'pwa-cache-reset-v3';
        if (!localStorage.getItem(resetKey)) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));

          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter((k) => k.startsWith('restaurpos-')).map((k) => caches.delete(k)));
          }

          localStorage.setItem(resetKey, '1');
        }

        const reg = await navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' });

        // Check for updates periodically
        setInterval(() => reg.update(), 60 * 60 * 1000);

        // Listen for SW messages (update notifications)
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'SW_UPDATED') {
            setUpdateAvailable(true);
          }
        });

        // Detect controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          setUpdateAvailable(true);
        });
      } catch (err) {
        console.warn('SW registration failed:', err);
      }
    };

    setupServiceWorker();

    // Install prompt handler
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    loadPWASettings();

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const loadPWASettings = async () => {
    try {
      const { data } = await supabase
        .from('store_settings')
        .select('pwa_name, pwa_short_name, pwa_description, pwa_icon_url, pwa_theme_color, pwa_background_color, pwa_orientation')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;

      const icons: any[] = [];
      if (data.pwa_icon_url) {
        icons.push(
          { src: data.pwa_icon_url, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: data.pwa_icon_url, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        );
      }

      const manifest = {
        name: data.pwa_name || 'RestaurPOS',
        short_name: data.pwa_short_name || 'RestaurPOS',
        description: data.pwa_description || 'Sistema PDV',
        start_url: '/',
        display: 'standalone',
        background_color: data.pwa_background_color || '#ffffff',
        theme_color: data.pwa_theme_color || '#6366f1',
        orientation: data.pwa_orientation || 'portrait',
        icons: icons.length > 0 ? icons : [{ src: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' }],
      };

      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      if (link) {
        link.href = url;
      } else {
        link = document.createElement('link');
        link.rel = 'manifest';
        link.href = url;
        document.head.appendChild(link);
      }

      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
      if (meta) {
        meta.content = data.pwa_theme_color || '#6366f1';
      }
    } catch (err) {
      console.warn('Failed to load PWA settings:', err);
    }
  };

  const installApp = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    setInstallPrompt(null);
    setIsInstallable(false);
    return result.outcome === 'accepted';
  }, [installPrompt]);

  const dismissIOSInstall = useCallback(() => {
    setShowIOSInstall(false);
    localStorage.setItem('ios-install-dismissed', Date.now().toString());
  }, []);

  const applyUpdate = useCallback(() => {
    setUpdateAvailable(false);
    window.location.reload();
  }, []);

  return {
    isInstallable,
    installApp,
    isStandalone,
    isIOS,
    showIOSInstall,
    dismissIOSInstall,
    updateAvailable,
    applyUpdate,
  };
};
