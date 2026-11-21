import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { fetchStoreSettingsRow, withLocalFallback } from "@/lib/storeSettings";
import { normalizeCatalogColumns } from '@/lib/catalogLayout';

interface ThemeSettings {
  category_columns: number;
  product_columns: number;
  store_name: string;
  subtitle_text: string;
  logo_url: string | null;
  logo_size: number;
  store_name_size: number;
  subtitle_size: number;
  menu_icon_size: number;
  cart_icon_size: number;
  save_icon_size: number;
  primary_color: string;
  gradient_enabled: boolean;
  gradient_color: string;
  gradient_direction: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  checkout_color: string;
  category_name_size: number;
  category_name_color: string;
  category_name_bg: string;
  product_name_size: number;
  product_name_color: string;
  product_name_bg: string;
  product_label_align: 'left' | 'center' | 'right';
}

interface ThemeContextType {
  settings: ThemeSettings;
  updateSettings: (newSettings: Partial<ThemeSettings>, savedStoreId?: string | null) => Promise<void>;
  loading: boolean;
}

const defaultSettings: ThemeSettings = {
  category_columns: 2,
  product_columns: 2,
  store_name: 'Sistema PDV',
  subtitle_text: 'Sistema de Vendas',
  logo_url: null,
  logo_size: 32,
  store_name_size: 20,
  subtitle_size: 12,
  menu_icon_size: 32,
  cart_icon_size: 24,
  save_icon_size: 24,
  primary_color: '#6366f1',
  gradient_enabled: false,
  gradient_color: '#8b5cf6',
  gradient_direction: '135deg',
  secondary_color: '#8b5cf6',
  accent_color: '#06b6d4',
  background_color: '#ffffff',
  checkout_color: '#22c55e',
  category_name_size: 14,
  category_name_color: '#1f2937',
  category_name_bg: '#f3f4f6',
  product_name_size: 14,
  product_name_color: '#1f2937',
  product_name_bg: '#ffffff',
  product_label_align: 'center',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ThemeSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const { scopeStoreId, writeStoreId } = useStore();
  const storeId = scopeStoreId ?? writeStoreId ?? null;
  const storeIdRef = useRef(storeId);
  storeIdRef.current = storeId;

  useEffect(() => {
    try {
      const cached = localStorage.getItem('pdv_theme_colors');
      if (cached) applyTheme({ ...defaultSettings, ...JSON.parse(cached) });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    try {
      // '*' evita falha total quando o banco ainda não tem alguma coluna nova
      const { data: rawData, isGlobal } = await fetchStoreSettingsRow(storeIdRef.current, '*');
      const data = withLocalFallback(rawData, isGlobal ? null : storeIdRef.current);


      if (data) {
        const themeSettings: ThemeSettings = {
          category_columns: normalizeCatalogColumns(data.category_columns),
          product_columns: normalizeCatalogColumns(data.product_columns),
          store_name: data.store_name || defaultSettings.store_name,
          subtitle_text: (data as any).subtitle_text || defaultSettings.subtitle_text,
          logo_url: data.logo_url,
          logo_size: data.logo_size || defaultSettings.logo_size,
          store_name_size: data.store_name_size ?? defaultSettings.store_name_size,
          subtitle_size: data.subtitle_size ?? defaultSettings.subtitle_size,
          menu_icon_size: data.menu_icon_size ?? defaultSettings.menu_icon_size,
          cart_icon_size: data.cart_icon_size ?? defaultSettings.cart_icon_size,
          save_icon_size: data.save_icon_size ?? defaultSettings.save_icon_size,
          primary_color: data.primary_color || defaultSettings.primary_color,
          gradient_enabled: !!(data as any).gradient_enabled,
          gradient_color: (data as any).gradient_color || defaultSettings.gradient_color,
          gradient_direction: (data as any).gradient_direction || defaultSettings.gradient_direction,
          secondary_color: data.secondary_color || defaultSettings.secondary_color,
          accent_color: data.accent_color || defaultSettings.accent_color,
          background_color: data.background_color || defaultSettings.background_color,
          checkout_color: data.checkout_color || defaultSettings.checkout_color,
          category_name_size: (data as any).category_name_size ?? defaultSettings.category_name_size,
          category_name_color: (data as any).category_name_color || defaultSettings.category_name_color,
          category_name_bg: (data as any).category_name_bg || defaultSettings.category_name_bg,
          product_name_size: (data as any).product_name_size ?? defaultSettings.product_name_size,
          product_name_color: (data as any).product_name_color || defaultSettings.product_name_color,
          product_name_bg: (data as any).product_name_bg || defaultSettings.product_name_bg,
          product_label_align: (data as any).product_label_align || defaultSettings.product_label_align,
        };
        setSettings(themeSettings);
        applyTheme(themeSettings);
      } else {
        // Sem configuração salva (ex.: sistema zerado): volta às cores padrão,
        // em vez de manter as cores antigas guardadas no aparelho.
        setSettings(defaultSettings);
        applyTheme(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading theme settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (themeSettings: ThemeSettings) => {
    const root = document.documentElement;

    // Force light mode to avoid accidental dark overlay
    root.classList.remove('dark');
    
    // Convert hex to HSL for CSS variables
    const hexToHsl = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
          default: h = 0;
        }
        h /= 6;
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };

    const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v || '');
    const set = (name: string, hex: string) => {
      if (isHex(hex)) root.style.setProperty(name, hexToHsl(hex));
    };
    const shade = (hex: string, delta: number) => {
      if (!isHex(hex)) return null;
      const [h, s, l] = hexToHsl(hex).split(' ');
      const nl = Math.max(0, Math.min(100, parseInt(l) + delta));
      return `${h} ${s} ${nl}%`;
    };
    const fgFor = (hex: string) => {
      if (!isHex(hex)) return null;
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '212 26% 12%' : '0 0% 98%';
    };
    const setRaw = (name: string, v: string | null) => { if (v) root.style.setProperty(name, v); };

    set('--primary', themeSettings.primary_color);
    set('--ring', themeSettings.primary_color);
    setRaw('--primary-light', shade(themeSettings.primary_color, 7));
    setRaw('--primary-dark', shade(themeSettings.primary_color, -8));
    setRaw('--primary-foreground', fgFor(themeSettings.primary_color));
    if (themeSettings.gradient_enabled && isHex(themeSettings.gradient_color) && isHex(themeSettings.primary_color)) {
      root.style.setProperty('--gradient-primary', `linear-gradient(${themeSettings.gradient_direction || '135deg'}, ${themeSettings.primary_color}, ${themeSettings.gradient_color})`);
    } else {
      root.style.removeProperty('--gradient-primary');
    }
    set('--secondary', themeSettings.secondary_color);
    setRaw('--secondary-foreground', fgFor(themeSettings.secondary_color));
    set('--accent', themeSettings.accent_color);
    setRaw('--accent-foreground', fgFor(themeSettings.accent_color));
    set('--checkout', themeSettings.checkout_color);
    // Cor de fundo exatamente como escolhida
    set('--background', themeSettings.background_color);
    setRaw('--foreground', fgFor(themeSettings.background_color));
    try { localStorage.setItem('pdv_theme_colors', JSON.stringify(themeSettings)); } catch {}
  };

  /** A gravação é feita pela tela de Configurações; aqui só recarrega a loja atual. */
  const updateSettings = async (newSettings: Partial<ThemeSettings>, savedStoreId?: string | null) => {
    // Aplica na hora quando a configuração salva é a da loja exibida no PDV
    if (savedStoreId === undefined || savedStoreId === storeIdRef.current || savedStoreId === null) {
      const merged = { ...settings, ...newSettings } as ThemeSettings;
      setSettings(merged);
      applyTheme(merged);
    }
    await loadSettings();
  };

  useEffect(() => {
    loadSettings();
  }, [storeId]);

  useEffect(() => {
    const channel = supabase
      .channel('theme-settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, () => {
        loadSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};