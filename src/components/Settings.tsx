import { StorageImage } from "@/components/ui/StorageImage";
import { clearDeviceCaches } from "@/lib/deviceCaches";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Store, User, Bell, Shield, Database, Palette, Smartphone, Printer, Download, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BackToMainButton } from "@/components/ui/BackToMainButton";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { LogoUpload } from "@/components/ui/LogoUpload";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useTheme } from "@/contexts/ThemeContext";
import { useStore } from "@/contexts/StoreContext";
import { fetchStoreSettingsRow, saveStoreSettingsRow, withLocalFallback } from "@/lib/storeSettings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePWA } from "@/hooks/usePWA";
import { AdminsTab } from "@/components/AdminsTab";
import { StoresTab } from "@/components/StoresTab";
import { AccountSecurityTab } from "@/components/AccountSecurityTab";
import { PaymentSettingsTab } from "@/components/PaymentSettingsTab";
import { normalizeCatalogColumns } from '@/lib/catalogLayout';

import {
  WeeklyHoursEditor,
  parseWeeklyHours,
  serializeWeeklyHours,
  DEFAULT_WEEKLY_HOURS,
} from "@/components/ui/WeeklyHoursEditor";
import {
  exportBackup,
  downloadBackup,
  parseBackupFile,
  importBackup,
} from "@/lib/backupData";
import {
  DATA_MODULES,
  type DataModule,
  type ModuleId,
  exportModule,
  downloadModuleBackup,
  parseModuleBackup,
  importModule,
  clearModule,
  clearAllModules,
} from "@/lib/dataModules";


interface StoreSettings {
  category_columns: number;
  product_columns: number;
  store_name: string;
  subtitle_text: string;
  address: string;
  phone: string;
  email: string;
  cnpj: string;
  opening_hours: string;
  notifications_enabled: boolean;
  auto_backup: boolean;
  low_stock_alert: boolean;
  min_stock_threshold: number;
  logo_url: string | null;
  primary_color: string;
  gradient_enabled: boolean;
  gradient_color: string;
  gradient_direction: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  checkout_color: string;
  logo_size: number;
  store_name_size: number;
  subtitle_size: number;
  menu_icon_size: number;
  cart_icon_size: number;
  save_icon_size: number;
  pwa_name: string;
  pwa_short_name: string;
  pwa_description: string;
  pwa_icon_url: string | null;
  pwa_theme_color: string;
  pwa_background_color: string;
  pwa_orientation: string;
  category_name_size: number;
  category_name_color: string;
  category_name_bg: string;
  product_name_size: number;
  product_name_color: string;
  product_name_bg: string;
  product_label_align: 'left' | 'center' | 'right';
  printer_width: string;
  printer_font_size: number;
  printer_show_logo: boolean;
  printer_show_address: boolean;
  printer_show_phone: boolean;
  printer_show_seller: boolean;
  printer_show_customer: boolean;
  printer_show_order_number: boolean;
  printer_show_payment_method: boolean;
  printer_show_date: boolean;
  printer_header_text: string;
  printer_footer_text: string;
  printer_margin_left: number;
}

interface SettingsProps {
  onBackToMain: () => void;
}

export const Settings = ({ onBackToMain }: SettingsProps) => {
  const [settings, setSettings] = useState<StoreSettings>({
    category_columns: 2,
    product_columns: 2,
    store_name: "",
    subtitle_text: "Sistema de Vendas",
    address: "",
    phone: "",
    email: "",
    cnpj: "",
    opening_hours: "",
    notifications_enabled: true,
    auto_backup: true,
    low_stock_alert: true,
    min_stock_threshold: 5,
    logo_url: null,
    primary_color: '#6366f1',
    gradient_enabled: false,
    gradient_color: '#8b5cf6',
    gradient_direction: '135deg',
    secondary_color: '#8b5cf6',
    accent_color: '#06b6d4',
    background_color: '#ffffff',
    checkout_color: '#22c55e',
    logo_size: 32,
    store_name_size: 20,
    subtitle_size: 12,
    menu_icon_size: 32,
    cart_icon_size: 24,
    save_icon_size: 24,
    pwa_name: 'RestaurPOS',
    pwa_short_name: 'RestaurPOS',
    pwa_description: 'Sistema completo de ponto de venda',
    pwa_icon_url: null,
    pwa_theme_color: '#6366f1',
    pwa_background_color: '#ffffff',
    pwa_orientation: 'portrait',
    category_name_size: 14,
    category_name_color: '#1f2937',
    category_name_bg: '#f3f4f6',
    product_name_size: 14,
    product_name_color: '#1f2937',
    product_name_bg: '#ffffff',
    product_label_align: 'center',
    printer_width: '58mm',
    printer_font_size: 10,
    printer_show_logo: true,
    printer_show_address: true,
    printer_show_phone: true,
    printer_show_seller: true,
    printer_show_customer: true,
    printer_show_order_number: true,
    printer_show_payment_method: true,
    printer_show_date: true,
    printer_header_text: '',
    printer_footer_text: 'Obrigado pela preferência!',
    printer_margin_left: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const moduleInputRef = useRef<HTMLInputElement>(null);
  const [moduleBusy, setModuleBusy] = useState<string | null>(null);
  const [restoreModuleId, setRestoreModuleId] = useState<ModuleId | null>(null);

  const { toast } = useToast();
  const { updateSettings: updateThemeSettings } = useTheme();
  const { isInstallable, installApp } = usePWA();
  const { stores, isSuperAdmin, scopeStoreId, writeStoreId } = useStore();
  const [scope, setScope] = useState<string>(scopeStoreId ?? writeStoreId ?? "all");
  const effectiveStoreId = isSuperAdmin ? (scope === "all" ? null : scope) : (scopeStoreId ?? writeStoreId ?? null);
  const storeLabel = effectiveStoreId ? (stores.find((s) => s.id === effectiveStoreId)?.name ?? "Loja") : "Todas as lojas";
  const [usesGlobal, setUsesGlobal] = useState(false);

  const resetToGlobal = async () => {
    if (!effectiveStoreId || !confirm("Voltar esta loja para a configuração de todas as lojas?")) return;
    const { error } = await supabase.from('store_settings').delete().eq('store_id', effectiveStoreId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Loja usando a configuração geral" });
    await loadSettings();
    await updateThemeSettings({});
  };

  useEffect(() => {
    loadSettings();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      setIsAdmin(data?.role === 'admin');
    })();
  }, []);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStoreId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data: rawData, isGlobal } = await fetchStoreSettingsRow(effectiveStoreId);
      const data = withLocalFallback(rawData, isGlobal ? null : effectiveStoreId);
      setUsesGlobal(!!effectiveStoreId && isGlobal);

      if (data) {
        setSettings({
          category_columns: normalizeCatalogColumns(data.category_columns),
          product_columns: normalizeCatalogColumns(data.product_columns),
          store_name: data.store_name || '',
          subtitle_text: (data as any).subtitle_text || 'Sistema de Vendas',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          cnpj: data.cnpj || '',
          opening_hours: data.opening_hours || '',
          notifications_enabled: data.notifications_enabled ?? true,
          auto_backup: data.auto_backup ?? true,
          low_stock_alert: data.low_stock_alert ?? true,
          min_stock_threshold: data.min_stock_threshold ?? 5,
          logo_url: data.logo_url || null,
          primary_color: data.primary_color || '#6366f1',
          gradient_enabled: !!(data as any).gradient_enabled,
          gradient_color: (data as any).gradient_color || '#8b5cf6',
          gradient_direction: (data as any).gradient_direction || '135deg',
          secondary_color: data.secondary_color || '#8b5cf6',
          accent_color: data.accent_color || '#06b6d4',
          background_color: data.background_color || '#ffffff',
          checkout_color: data.checkout_color || '#22c55e',
          logo_size: data.logo_size ?? 32,
          store_name_size: (data as any).store_name_size ?? 20,
          subtitle_size: (data as any).subtitle_size ?? 12,
          menu_icon_size: (data as any).menu_icon_size ?? 32,
          cart_icon_size: data.cart_icon_size ?? 24,
          save_icon_size: data.save_icon_size ?? 24,
          pwa_name: data.pwa_name || 'RestaurPOS',
          pwa_short_name: data.pwa_short_name || 'RestaurPOS',
          pwa_description: data.pwa_description || 'Sistema completo de ponto de venda',
          pwa_icon_url: data.pwa_icon_url || null,
          pwa_theme_color: data.pwa_theme_color || '#6366f1',
          pwa_background_color: data.pwa_background_color || '#ffffff',
          pwa_orientation: data.pwa_orientation || 'portrait',
          category_name_size: (data as any).category_name_size ?? 14,
          category_name_color: (data as any).category_name_color || '#1f2937',
          category_name_bg: (data as any).category_name_bg || '#f3f4f6',
          product_name_size: (data as any).product_name_size ?? 14,
          product_name_color: (data as any).product_name_color || '#1f2937',
          product_name_bg: (data as any).product_name_bg || '#ffffff',
          product_label_align: (data as any).product_label_align || 'center',
          printer_width: (data as any).printer_width || '58mm',
          printer_font_size: (data as any).printer_font_size ?? 10,
          printer_show_logo: (data as any).printer_show_logo ?? true,
          printer_show_address: (data as any).printer_show_address ?? true,
          printer_show_phone: (data as any).printer_show_phone ?? true,
          printer_show_seller: (data as any).printer_show_seller ?? true,
          printer_show_customer: (data as any).printer_show_customer ?? true,
          printer_show_order_number: (data as any).printer_show_order_number ?? true,
          printer_show_payment_method: (data as any).printer_show_payment_method ?? true,
          printer_show_date: (data as any).printer_show_date ?? true,
          printer_header_text: (data as any).printer_header_text || '',
          printer_footer_text: (data as any).printer_footer_text ?? 'Obrigado pela preferência!',
          printer_margin_left: (data as any).printer_margin_left ?? 0,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Garante uma linha própria para o escopo atual (loja específica ou geral)
      // A tela já mostra a configuração herdada, então basta gravar uma única linha para o escopo.
      const scopeQuery = supabase
        .from('store_settings')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);
      const { data: existing, error: fetchError } = effectiveStoreId
        ? await scopeQuery.eq('store_id', effectiveStoreId).maybeSingle()
        : await scopeQuery.is('store_id', null).maybeSingle();

      if (fetchError) throw fetchError;

      const payload = {
        category_columns: settings.category_columns,
        product_columns: settings.product_columns,
        store_id: effectiveStoreId,
        store_name: settings.store_name,
        subtitle_text: settings.subtitle_text,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        cnpj: settings.cnpj,
        opening_hours: settings.opening_hours,
        notifications_enabled: settings.notifications_enabled,
        auto_backup: settings.auto_backup,
        low_stock_alert: settings.low_stock_alert,
        min_stock_threshold: settings.min_stock_threshold,
        logo_url: settings.logo_url,
        primary_color: settings.primary_color,
        gradient_enabled: settings.gradient_enabled,
        gradient_color: settings.gradient_color,
        gradient_direction: settings.gradient_direction,
        secondary_color: settings.secondary_color,
        accent_color: settings.accent_color,
        background_color: settings.background_color,
        checkout_color: settings.checkout_color,
        logo_size: settings.logo_size,
        store_name_size: settings.store_name_size,
        subtitle_size: settings.subtitle_size,
        menu_icon_size: settings.menu_icon_size,
        cart_icon_size: settings.cart_icon_size,
        save_icon_size: settings.save_icon_size,
        pwa_name: settings.pwa_name,
        pwa_short_name: settings.pwa_short_name,
        pwa_description: settings.pwa_description,
        pwa_icon_url: settings.pwa_icon_url,
        pwa_theme_color: settings.pwa_theme_color,
        pwa_background_color: settings.pwa_background_color,
        pwa_orientation: settings.pwa_orientation,
        category_name_size: settings.category_name_size,
        category_name_color: settings.category_name_color,
        category_name_bg: settings.category_name_bg,
        product_name_size: settings.product_name_size,
        product_name_color: settings.product_name_color,
        product_name_bg: settings.product_name_bg,
        product_label_align: settings.product_label_align,
        printer_width: settings.printer_width,
        printer_font_size: settings.printer_font_size,
        printer_show_logo: settings.printer_show_logo,
        printer_show_address: settings.printer_show_address,
        printer_show_phone: settings.printer_show_phone,
        printer_show_seller: settings.printer_show_seller,
        printer_show_customer: settings.printer_show_customer,
        printer_show_order_number: settings.printer_show_order_number,
        printer_show_payment_method: settings.printer_show_payment_method,
        printer_show_date: settings.printer_show_date,
        printer_header_text: settings.printer_header_text,
        printer_footer_text: settings.printer_footer_text,
        printer_margin_left: settings.printer_margin_left,
      };

      await saveStoreSettingsRow(existing?.id ?? null, payload);

      // Update theme context
      await updateThemeSettings({
        category_columns: settings.category_columns,
        product_columns: settings.product_columns,
        store_name: settings.store_name,
        subtitle_text: settings.subtitle_text,
        logo_url: settings.logo_url,
        logo_size: settings.logo_size,
        store_name_size: settings.store_name_size,
        subtitle_size: settings.subtitle_size,
        menu_icon_size: settings.menu_icon_size,
        cart_icon_size: settings.cart_icon_size,
        save_icon_size: settings.save_icon_size,
        primary_color: settings.primary_color,
        gradient_enabled: settings.gradient_enabled,
        gradient_color: settings.gradient_color,
        gradient_direction: settings.gradient_direction,
        secondary_color: settings.secondary_color,
        accent_color: settings.accent_color,
        background_color: settings.background_color,
        checkout_color: settings.checkout_color,
        category_name_size: settings.category_name_size,
        category_name_color: settings.category_name_color,
        category_name_bg: settings.category_name_bg,
        product_name_size: settings.product_name_size,
        product_name_color: settings.product_name_color,
        product_name_bg: settings.product_name_bg,
        product_label_align: settings.product_label_align,
      }, effectiveStoreId ?? null);

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro",
        description: `Não foi possível salvar as configurações${(error as any)?.message ? ": " + (error as any).message : ""}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    try {
      setExporting(true);
      toast({
        title: "Exportação iniciada",
        description: "Os dados estão sendo preparados para download",
      });

      const backup = await exportBackup();
      downloadBackup(backup);

      const total = Object.values(backup.data).reduce(
        (sum, rows) => sum + (rows as any[]).length,
        0
      );
      toast({
        title: "Exportação concluída",
        description: `${total} registros salvos no arquivo de backup`,
      });
    } catch (error: any) {
      console.error("Error exporting data:", error);
      toast({
        title: "Erro",
        description: error?.message ?? "Não foi possível exportar os dados",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const confirmed = window.confirm(
      "Importar este backup irá adicionar e sobrescrever registros existentes com o mesmo identificador. Deseja continuar?"
    );
    if (!confirmed) return;

    try {
      setImporting(true);
      const backup = parseBackupFile(await file.text());
      const results = await importBackup(backup);
      const failed = results.filter((r) => r.error);
      const total = results.reduce((sum, r) => sum + r.count, 0);

      if (failed.length > 0) {
        toast({
          title: "Importação parcial",
          description: `${total} registros restaurados. Falhas em: ${failed
            .map((f) => f.table)
            .join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Importação concluída",
          description: `${total} registros restaurados com sucesso`,
        });
      }
      await loadSettings();
    } catch (error: any) {
      console.error("Error importing data:", error);
      toast({
        title: "Erro",
        description: error?.message ?? "Arquivo de backup inválido",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const backupModule = async (mod: DataModule) => {
    try {
      setModuleBusy(`export-${mod.id}`);
      const backup = await exportModule(mod);
      downloadModuleBackup(backup);
      const total = Object.values(backup.data).reduce((s, r) => s + r.length, 0);
      toast({
        title: `Backup de ${mod.label} concluído`,
        description: `${total} registros salvos no arquivo`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message ?? "Não foi possível gerar o backup",
        variant: "destructive",
      });
    } finally {
      setModuleBusy(null);
    }
  };

  const handleModuleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const mod = DATA_MODULES.find((m) => m.id === restoreModuleId);
    setRestoreModuleId(null);
    if (!file || !mod) return;

    if (
      !window.confirm(
        `Restaurar o backup de ${mod.label}? Registros existentes com o mesmo identificador serão sobrescritos.`
      )
    )
      return;

    try {
      setModuleBusy(`import-${mod.id}`);
      const backup = parseModuleBackup(await file.text(), mod);
      const total = await importModule(mod, backup);
      toast({
        title: `${mod.label} restaurado`,
        description: `${total} registros restaurados com sucesso`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message ?? "Arquivo de backup inválido",
        variant: "destructive",
      });
    } finally {
      setModuleBusy(null);
    }
  };

  const clearModuleData = async (mod: DataModule) => {
    if (
      !window.confirm(
        `ATENÇÃO: todos os dados de ${mod.label} serão apagados permanentemente. Recomendamos fazer o backup antes. Continuar?`
      )
    )
      return;
    if (!window.confirm(`Confirmação final: apagar todos os dados de ${mod.label}?`)) return;

    try {
      setModuleBusy(`clear-${mod.id}`);
      const { hiddenProducts } = await clearModule(mod);
      toast({
        title: `${mod.label} limpo`,
        description:
          hiddenProducts > 0
            ? `Os dados foram removidos. ${hiddenProducts} produto(s) aparecem em vendas antigas e foram apenas ocultados. Para apagá-los de vez, limpe Vendas antes.`
            : "Os dados foram removidos com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message ?? "Não foi possível limpar os dados",
        variant: "destructive",
      });
    } finally {
      setModuleBusy(null);
    }
  };


  const factoryReset = async () => {
    if (!window.confirm(
      "ATENÇÃO MÁXIMA: TODO o sistema será apagado — lojas, usuários, cardápio, vendas, clientes, fotos e configurações. Fica só a conta do primeiro super administrador. Não há como desfazer. Continuar?"
    )) return;
    const typed = window.prompt('Para confirmar, digite exatamente: APAGAR TUDO');
    if (typed !== "APAGAR TUDO") {
      toast({ title: "Cancelado", description: "O texto de confirmação não confere." });
      return;
    }
    try {
      setModuleBusy("factory");
      const { data, error } = await supabase.functions.invoke("factory-reset", { body: { confirm: "APAGAR TUDO" } });
      if (error || (data as any)?.error) {
        let msg = (data as any)?.error ?? error?.message;
        try { msg = (await (error as any)?.context?.json())?.error ?? msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      clearDeviceCaches();
      toast({ title: "Sistema apagado", description: "Tudo foi zerado. A página será recarregada." });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message ?? "Não foi possível apagar o sistema", variant: "destructive" });
    } finally {
      setModuleBusy(null);
    }
  };

  const clearData = async () => {
    const confirmed = window.confirm(
      "ATENÇÃO: serão apagados vendas, clientes e todo o cardápio (categorias, produtos e complementos). Esta operação não pode ser desfeita. Recomendamos exportar os dados antes. Continuar?"
    );
    if (!confirmed) return;
    if (!window.confirm("ÚLTIMA CONFIRMAÇÃO: todos esses dados serão perdidos permanentemente. Prosseguir?")) return;

    try {
      setModuleBusy("clear-all");
      await clearAllModules();
      toast({
        title: "Dados limpos",
        description: "Vendas, clientes e cardápio foram apagados. Lojas, usuários e configurações foram mantidos.",
      });
    } catch (error: any) {
      console.error("Error clearing data:", error);
      toast({
        title: "Erro",
        description: error?.message ?? "Não foi possível limpar os dados",
        variant: "destructive",
      });
    } finally {
      setModuleBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8" />
        <h2 className="text-3xl font-bold">Configurações do Sistema</h2>
      </div>

      {isSuperAdmin && (
        <Card>
          <CardContent className="pt-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <Label>Configurar para</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as lojas (padrão)</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}{s.active ? "" : " (inativa)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {effectiveStoreId
                  ? (usesGlobal
                      ? `${storeLabel} usa a configuração de todas as lojas. Ao salvar, ela passa a ter configuração própria.`
                      : `${storeLabel} tem configuração própria de Loja e Aparência.`)
                  : "Vale para todas as lojas que não tiverem configuração própria."}
              </p>
              {effectiveStoreId && !usesGlobal && (
                <Button variant="outline" size="sm" className="mt-2" onClick={resetToGlobal}>
                  Voltar a usar a configuração de todas as lojas
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="store" className="w-full">
        <TabsList
          className={`grid w-full gap-1 h-auto p-1 grid-cols-2 sm:grid-cols-3 ${
            isAdmin ? 'md:grid-cols-8' : 'md:grid-cols-6'
          }`}
        >
          <TabsTrigger value="store" className="text-xs sm:text-sm py-2">Loja</TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs sm:text-sm py-2">Aparência</TabsTrigger>
          <TabsTrigger value="printer" className="text-xs sm:text-sm py-2">Impressora</TabsTrigger>
          {isAdmin && <TabsTrigger value="payments" className="text-xs sm:text-sm py-2">Pagamentos</TabsTrigger>}
          <TabsTrigger value="notifications" className="text-xs sm:text-sm py-2">Notificações</TabsTrigger>
          {isAdmin && <TabsTrigger value="admins" className="text-xs sm:text-sm py-2">Admins</TabsTrigger>}
          {isAdmin && <TabsTrigger value="stores" className="text-xs sm:text-sm py-2">Lojas</TabsTrigger>}
          {isAdmin && <TabsTrigger value="account" className="text-xs sm:text-sm py-2">Segurança e Conta</TabsTrigger>}
          <TabsTrigger value="system" className="text-xs sm:text-sm py-2">Sistema</TabsTrigger>
          <TabsTrigger value="pwa" className="text-xs sm:text-sm py-2">PWA</TabsTrigger>
        </TabsList>


        <TabsContent value="store" className="space-y-6">
          {/* Informações da Loja */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Informações da Loja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="store_name">Nome da Loja</Label>
                  <Input
                    id="store_name"
                    value={settings.store_name}
                    onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                    placeholder="Nome da sua loja"
                  />
                </div>
                <div>
                  <Label htmlFor="subtitle_text">Subtítulo</Label>
                  <Input
                    id="subtitle_text"
                    value={settings.subtitle_text}
                    onChange={(e) => setSettings({ ...settings, subtitle_text: e.target.value })}
                    placeholder="Texto abaixo do nome da loja"
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={settings.cnpj}
                    onChange={(e) => setSettings({ ...settings, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    placeholder="contato@loja.com"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Endereço</Label>
                <Textarea
                  id="address"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Endereço completo da loja"
                />
              </div>
              <div>
                <WeeklyHoursEditor
                  value={parseWeeklyHours(settings.opening_hours)}
                  onChange={(wh) =>
                    setSettings({ ...settings, opening_hours: serializeWeeklyHours(wh) })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          {/* Personalização Visual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Personalização Visual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <LogoUpload
                    value={settings.logo_url}
                    onChange={(url) => setSettings({ ...settings, logo_url: url })}
                  />
                  <div className="space-y-2">
                    <Label>Tamanho da Logo: {settings.logo_size}px</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">16px</span>
                      <input
                        type="range"
                        min="16"
                        max="150"
                        step="2"
                        value={settings.logo_size}
                        onChange={(e) => setSettings({ ...settings, logo_size: parseInt(e.target.value) })}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">80px</span>
                    </div>
                    {settings.logo_url && (
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                        <span className="text-sm text-muted-foreground">Preview:</span>
                        <StorageImage
                          src={settings.logo_url}
                          alt="Preview logo"
                          style={{ width: settings.logo_size, height: settings.logo_size }}
                          className="object-contain"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Tamanho do Nome da Loja: {settings.store_name_size}px</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">12px</span>
                      <input
                        type="range"
                        min="12"
                        max="48"
                        step="1"
                        value={settings.store_name_size}
                        onChange={(e) => setSettings({ ...settings, store_name_size: parseInt(e.target.value) })}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">48px</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tamanho do Subtítulo: {settings.subtitle_size}px</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">8px</span>
                      <input
                        type="range"
                        min="8"
                        max="24"
                        step="1"
                        value={settings.subtitle_size}
                        onChange={(e) => setSettings({ ...settings, subtitle_size: parseInt(e.target.value) })}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">24px</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tamanho do Ícone do Menu: {settings.menu_icon_size}px</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">16px</span>
                      <input
                        type="range"
                        min="16"
                        max="48"
                        step="2"
                        value={settings.menu_icon_size}
                        onChange={(e) => setSettings({ ...settings, menu_icon_size: parseInt(e.target.value) })}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">48px</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cart-icon-size">Tamanho do Ícone do Carrinho: {settings.cart_icon_size}px</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">16px</span>
                      <input
                        id="cart-icon-size"
                        type="range"
                        min="16"
                        max="48"
                        step="2"
                        value={settings.cart_icon_size}
                        onChange={(e) => setSettings({ ...settings, cart_icon_size: parseInt(e.target.value) })}
                        className="min-w-0 flex-1 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">48px</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="save-icon-size">Tamanho do Ícone de Salvar: {settings.save_icon_size}px</Label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">16px</span>
                      <input
                        id="save-icon-size"
                        type="range"
                        min="16"
                        max="48"
                        step="2"
                        value={settings.save_icon_size}
                        onChange={(e) => setSettings({ ...settings, save_icon_size: parseInt(e.target.value) })}
                        className="min-w-0 flex-1 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground">48px</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="store_name_display">Nome do Restaurante</Label>
                    <Input
                      id="store_name_display"
                      value={settings.store_name}
                      onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                      placeholder="Nome que aparecerá no sistema"
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-lg font-medium mb-4">Cores do Sistema</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ColorPicker
                    label="Cor Primária"
                    value={settings.primary_color}
                    onChange={(color) => setSettings({ ...settings, primary_color: color })}
                  />
                  <ColorPicker
                    label="Cor Secundária"
                    value={settings.secondary_color}
                    onChange={(color) => setSettings({ ...settings, secondary_color: color })}
                  />
                  <ColorPicker
                    label="Cor de Destaque"
                    value={settings.accent_color}
                    onChange={(color) => setSettings({ ...settings, accent_color: color })}
                  />
                  <ColorPicker
                    label="Cor de Fundo"
                    value={settings.background_color}
                    onChange={(color) => setSettings({ ...settings, background_color: color })}
                  />
                  <ColorPicker
                    label="Cor do Botão Cobrar"
                    value={settings.checkout_color}
                    onChange={(color) => setSettings({ ...settings, checkout_color: color })}
                  />
                </div>
              </div>

              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h5 className="font-medium">Degradê da Cor Primária</h5>
                    <p className="text-sm text-muted-foreground">Aplica no topo da tela e no rótulo dos cartões das categorias.</p>
                  </div>
                  <Switch checked={settings.gradient_enabled} onCheckedChange={(v) => setSettings({ ...settings, gradient_enabled: v })} />
                </div>
                {settings.gradient_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorPicker
                      label="Segunda cor do degradê"
                      value={settings.gradient_color}
                      onChange={(color) => setSettings({ ...settings, gradient_color: color })}
                    />
                    <div className="space-y-2">
                      <Label>Direção</Label>
                      <Select value={settings.gradient_direction} onValueChange={(v) => setSettings({ ...settings, gradient_direction: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90deg">Horizontal (esquerda → direita)</SelectItem>
                          <SelectItem value="180deg">Vertical (cima → baixo)</SelectItem>
                          <SelectItem value="135deg">Diagonal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2 h-12 rounded border" style={{ background: `linear-gradient(${settings.gradient_direction}, ${settings.primary_color}, ${settings.gradient_color})` }} title="Prévia do degradê" />
                  </div>
                )}
              </div>

              <div className="p-4 border rounded-lg bg-muted/50">
                <h5 className="font-medium mb-2">Preview das Cores</h5>
                <div className="flex gap-2">
                  <div
                    className="w-12 h-12 rounded border"
                    style={{ backgroundColor: settings.primary_color }}
                    title="Cor Primária"
                  />
                  <div
                    className="w-12 h-12 rounded border"
                    style={{ backgroundColor: settings.secondary_color }}
                    title="Cor Secundária"
                  />
                  <div
                    className="w-12 h-12 rounded border"
                    style={{ backgroundColor: settings.accent_color }}
                    title="Cor de Destaque"
                  />
                  <div
                    className="w-12 h-12 rounded border"
                    style={{ backgroundColor: settings.background_color }}
                    title="Cor de Fundo"
                  />
                  <div
                    className="w-12 h-12 rounded border"
                    style={{ backgroundColor: settings.checkout_color }}
                    title="Cor do Botão Cobrar"
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-lg font-medium mb-4">Imagens e Rótulo das Categorias</h4>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="category-columns">Tamanho das imagens / colunas de categorias</Label>
                  <Select value={String(settings.category_columns)} onValueChange={(value) => setSettings({ ...settings, category_columns: normalizeCatalogColumns(Number(value)) })}>
                    <SelectTrigger id="category-columns" className="w-full sm:w-72"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 colunas — imagens grandes</SelectItem>
                      <SelectItem value="3">3 colunas — imagens médias</SelectItem>
                      <SelectItem value="4">4 colunas — imagens pequenas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Tamanho da fonte: {settings.category_name_size}px</Label>
                    <input
                      type="range"
                      min="10"
                      max="32"
                      step="1"
                      value={settings.category_name_size}
                      onChange={(e) => setSettings({ ...settings, category_name_size: parseInt(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                  <ColorPicker
                    label="Cor do texto"
                    value={settings.category_name_color}
                    onChange={(color) => setSettings({ ...settings, category_name_color: color })}
                  />
                  <ColorPicker
                    label="Cor de fundo"
                    value={settings.category_name_bg}
                    onChange={(color) => setSettings({ ...settings, category_name_bg: color })}
                  />
                </div>
                <div
                  className="p-3 rounded-md text-center font-bold border"
                  style={{
                    backgroundColor: settings.category_name_bg,
                    color: settings.category_name_color,
                    fontSize: `${settings.category_name_size}px`,
                  }}
                >
                  Exemplo Categoria
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-lg font-medium mb-4">Imagens e Rótulo dos Produtos</h4>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="product-columns">Tamanho das imagens / colunas de produtos</Label>
                  <Select value={String(settings.product_columns)} onValueChange={(value) => setSettings({ ...settings, product_columns: normalizeCatalogColumns(Number(value)) })}>
                    <SelectTrigger id="product-columns" className="w-full sm:w-72"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 colunas — imagens grandes</SelectItem>
                      <SelectItem value="3">3 colunas — imagens médias</SelectItem>
                      <SelectItem value="4">4 colunas — imagens pequenas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Tamanho da fonte: {settings.product_name_size}px</Label>
                    <input
                      type="range"
                      min="10"
                      max="32"
                      step="1"
                      value={settings.product_name_size}
                      onChange={(e) => setSettings({ ...settings, product_name_size: parseInt(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                  <ColorPicker
                    label="Cor do texto"
                    value={settings.product_name_color}
                    onChange={(color) => setSettings({ ...settings, product_name_color: color })}
                  />
                  <ColorPicker
                    label="Cor de fundo"
                    value={settings.product_name_bg}
                    onChange={(color) => setSettings({ ...settings, product_name_bg: color })}
                  />
                </div>
                <div className="space-y-2 mb-4">
                  <Label>Posição do nome e do valor</Label>
                  <div className="flex gap-2">
                    {([['left','Esquerda'],['center','Centro'],['right','Direita']] as const).map(([v,l]) => (
                      <Button key={v} type="button" size="sm"
                        variant={settings.product_label_align === v ? 'default' : 'outline'}
                        onClick={() => setSettings({ ...settings, product_label_align: v })}>{l}</Button>
                    ))}
                  </div>
                </div>
                <div
                  className="p-3 rounded-md font-semibold border"
                  style={{
                    textAlign: settings.product_label_align,
                    backgroundColor: settings.product_name_bg,
                    color: settings.product_name_color,
                    fontSize: `${settings.product_name_size}px`,
                  }}
                >
                  Exemplo Produto
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          {/* Notificações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notificações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications_enabled">Notificações Ativadas</Label>
                  <p className="text-sm text-muted-foreground">
                    Receber notificações sobre eventos importantes
                  </p>
                </div>
                <Switch
                  id="notifications_enabled"
                  checked={settings.notifications_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, notifications_enabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="low_stock_alert">Alerta de Estoque Baixo</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar quando produtos estiverem com estoque baixo
                  </p>
                </div>
                <Switch
                  id="low_stock_alert"
                  checked={settings.low_stock_alert}
                  onCheckedChange={(checked) => setSettings({ ...settings, low_stock_alert: checked })}
                />
              </div>
              {settings.low_stock_alert && (
                <div>
                  <Label htmlFor="min_stock_threshold">Limite Mínimo de Estoque</Label>
                  <Input
                    id="min_stock_threshold"
                    type="number"
                    min="1"
                    value={settings.min_stock_threshold}
                    onChange={(e) => setSettings({ ...settings, min_stock_threshold: parseInt(e.target.value) || 5 })}
                    placeholder="5"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          {/* Sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto_backup">Backup Automático</Label>
                  <p className="text-sm text-muted-foreground">
                    Realizar backup automático dos dados diariamente
                  </p>
                </div>
                <Switch
                  id="auto_backup"
                  checked={settings.auto_backup}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_backup: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <h4 className="font-medium">Gerenciamento de Dados</h4>
                <div className="flex flex-col gap-2">
                  <Button onClick={exportData} variant="outline" disabled={exporting || importing}>
                    <Database className="w-4 h-4 mr-2" />
                    {exporting ? "Exportando..." : "Exportar Dados"}
                  </Button>
                  <Button
                    onClick={() => importInputRef.current?.click()}
                    variant="outline"
                    disabled={exporting || importing}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    {importing ? "Importando..." : "Importar Dados"}
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <p className="text-xs text-muted-foreground">
                    A exportação gera um arquivo .json com produtos, categorias, vendas,
                    clientes e configurações. Use esse arquivo na importação para restaurar.
                  </p>
                  <Button onClick={clearData} variant="destructive" disabled={moduleBusy !== null}>
                    <Shield className="w-4 h-4 mr-2" />
                    {moduleBusy === "clear-all" ? "Limpando..." : "Limpar Todos os Dados"}
                  </Button>
                  <Button onClick={factoryReset} variant="destructive" disabled={moduleBusy !== null} className="mt-2">
                    <Shield className="w-4 h-4 mr-2" />
                    {moduleBusy === "factory" ? "Apagando o sistema..." : "Apagar todo o sistema (voltar ao zero)"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Apaga lojas, usuários, cardápio, vendas, clientes, fotos e todas as configurações.
                    Fica só a conta do primeiro super administrador. Só ele pode usar este botão.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Gerenciamento Individual</h4>
                <p className="text-xs text-muted-foreground">
                  Faça backup, restaure ou limpe cada área do sistema separadamente.
                </p>
                {DATA_MODULES.map((mod) => (
                  <div key={mod.id} className="rounded-lg border p-3 space-y-3">
                    <div>
                      <p className="font-medium">{mod.label}</p>
                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={moduleBusy !== null}
                        onClick={() => backupModule(mod)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {moduleBusy === `export-${mod.id}` ? "Gerando..." : "Backup"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={moduleBusy !== null}
                        onClick={() => {
                          setRestoreModuleId(mod.id);
                          setTimeout(() => moduleInputRef.current?.click(), 0);
                        }}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {moduleBusy === `import-${mod.id}` ? "Restaurando..." : "Restaurar"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={moduleBusy !== null}
                        onClick={() => clearModuleData(mod)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {moduleBusy === `clear-${mod.id}` ? "Limpando..." : "Limpar"}
                      </Button>
                    </div>
                  </div>
                ))}
                <input
                  ref={moduleInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleModuleImportFile}
                />
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pwa" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Configurações do Aplicativo (PWA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pwa_name">Nome do Aplicativo</Label>
                  <Input
                    id="pwa_name"
                    value={settings.pwa_name}
                    onChange={(e) => setSettings({ ...settings, pwa_name: e.target.value })}
                    placeholder="Nome exibido ao instalar"
                  />
                </div>
                <div>
                  <Label htmlFor="pwa_short_name">Nome Curto</Label>
                  <Input
                    id="pwa_short_name"
                    value={settings.pwa_short_name}
                    onChange={(e) => setSettings({ ...settings, pwa_short_name: e.target.value })}
                    placeholder="Nome abaixo do ícone"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="pwa_description">Descrição</Label>
                <Textarea
                  id="pwa_description"
                  value={settings.pwa_description}
                  onChange={(e) => setSettings({ ...settings, pwa_description: e.target.value })}
                  placeholder="Descrição do aplicativo"
                />
              </div>

              <Separator />

              <ImageUpload
                value={settings.pwa_icon_url}
                onChange={(url) => setSettings({ ...settings, pwa_icon_url: url })}
                label="Ícone do Aplicativo (recomendado: 512x512px)"
                bucket="catalog-images"
                folder="pwa-icons"
              />

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorPicker
                  label="Cor Principal (theme_color)"
                  value={settings.pwa_theme_color}
                  onChange={(color) => setSettings({ ...settings, pwa_theme_color: color })}
                />
                <ColorPicker
                  label="Cor de Fundo (background_color)"
                  value={settings.pwa_background_color}
                  onChange={(color) => setSettings({ ...settings, pwa_background_color: color })}
                />
              </div>

              <div>
                <Label>Orientação</Label>
                <Select
                  value={settings.pwa_orientation}
                  onValueChange={(value) => setSettings({ ...settings, pwa_orientation: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Retrato (Portrait)</SelectItem>
                    <SelectItem value="landscape">Paisagem (Landscape)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {isInstallable && (
                <Button onClick={installApp} className="w-full" size="lg">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Instalar Aplicativo
                </Button>
              )}

              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  💡 Após salvar as configurações, atualize a página para que as alterações do PWA entrem em vigor.
                  {!isInstallable && " O botão de instalação aparecerá quando o navegador detectar que o app pode ser instalado."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="printer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="w-5 h-5" />
                Configurações da Impressora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Largura do papel e tamanho da fonte */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Largura do Papel</Label>
                  <Select
                    value={settings.printer_width}
                    onValueChange={(value) => setSettings({ ...settings, printer_width: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">58mm (Padrão)</SelectItem>
                      <SelectItem value="80mm">80mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tamanho da Fonte: {settings.printer_font_size}px</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="range"
                      min="6"
                      max="16"
                      value={settings.printer_font_size}
                      onChange={(e) => setSettings({ ...settings, printer_font_size: parseInt(e.target.value) })}
                      className="w-full"
                    />
                </div>
              </div>

              <div>
                <Label>Centralização da Impressão (margem esquerda): {settings.printer_margin_left}mm</Label>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={settings.printer_margin_left}
                    onChange={(e) => setSettings({ ...settings, printer_margin_left: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={40}
                    value={settings.printer_margin_left}
                    onChange={(e) => setSettings({ ...settings, printer_margin_left: Math.max(0, Math.min(40, parseInt(e.target.value) || 0)) })}
                    className="w-20"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ajuste caso a impressão esteja cortada ou desalinhada no papel. Aumente para deslocar o conteúdo para a direita.
                </p>
              </div>
              </div>

              <Separator />

              {/* O que exibir na comanda */}
              <div>
                <Label className="text-base font-semibold">Itens exibidos na comanda</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  {[
                    { key: 'printer_show_logo' as const, label: 'Logo da Loja' },
                    { key: 'printer_show_address' as const, label: 'Endereço' },
                    { key: 'printer_show_phone' as const, label: 'Telefone' },
                    { key: 'printer_show_order_number' as const, label: 'Número do Pedido' },
                    { key: 'printer_show_date' as const, label: 'Data e Hora' },
                    { key: 'printer_show_customer' as const, label: 'Nome do Cliente' },
                    { key: 'printer_show_seller' as const, label: 'Nome do Vendedor' },
                    { key: 'printer_show_payment_method' as const, label: 'Método de Pagamento' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                      <Switch
                        id={key}
                        checked={settings[key]}
                        onCheckedChange={(checked) => setSettings({ ...settings, [key]: checked })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Textos personalizados */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="printer_header_text">Texto do Cabeçalho (opcional)</Label>
                  <Input
                    id="printer_header_text"
                    value={settings.printer_header_text}
                    onChange={(e) => setSettings({ ...settings, printer_header_text: e.target.value })}
                    placeholder="Ex: Bem-vindo!"
                  />
                </div>
                <div>
                  <Label htmlFor="printer_footer_text">Texto do Rodapé</Label>
                  <Input
                    id="printer_footer_text"
                    value={settings.printer_footer_text}
                    onChange={(e) => setSettings({ ...settings, printer_footer_text: e.target.value })}
                    placeholder="Ex: Obrigado pela preferência!"
                  />
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  💡 Essas configurações serão aplicadas automaticamente ao imprimir comandas e recibos.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="payments" className="space-y-6">
            <PaymentSettingsTab />
          </TabsContent>
        )}


        {isAdmin && (
          <TabsContent value="admins" className="space-y-6">
            <AdminsTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="stores" className="space-y-6">
            <StoresTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="account" className="space-y-6">
            <AccountSecurityTab />
          </TabsContent>
        )}


        {/* Botão Salvar - apenas admins */}
        {isAdmin && (
          <div className="flex justify-end mt-6">
            <Button onClick={saveSettings} disabled={saving} size="lg">
              {saving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        )}
      </Tabs>
    </div>
  );
};