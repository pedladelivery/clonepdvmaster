import { useState, useEffect, useRef, useCallback } from "react";
import { PDVHeader } from "@/components/PDVHeader";
import { CatalogGrid } from "@/components/CatalogGrid";
import { CategoryCard } from "@/components/CategoryCard";
import { ProductCard } from "@/components/ProductCard";
import { Cart } from "@/components/Cart";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { SidebarMenu } from "@/components/SidebarMenu";
import { PendingSales } from "@/components/PendingSales";
import { Reports } from "@/components/Reports";
import { CustomerManagement } from "@/components/CustomerManagement";
import { CatalogManagement } from "@/components/CatalogManagement";
import { SupplierManagement } from "@/components/SupplierManagement";
import { SellerManagement } from "@/components/SellerManagement";
import { SalesHistory } from "@/components/SalesHistory";
import { Returns } from "@/components/Returns";
import { StockManagement } from "@/components/StockManagement";
import { Financial } from "@/components/Financial";
import { Settings } from "@/components/Settings";
import { MySubscription } from "@/components/MySubscription";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SellerSelector } from "@/components/SellerSelector";
import { PrintReceipt } from "@/components/PrintReceipt";
import { printSaleReceipt } from "@/lib/printSaleReceipt";
import { PaymentMethodDialog } from "@/components/ui/PaymentMethodDialog";
import { CategoryProductsModal } from "@/components/CategoryProductsModal";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ExpandableCartPanel } from "@/components/ExpandableCartPanel";
import { SaveOrderDialog } from "@/components/ui/SaveOrderDialog";
import { PdvControlsBanner } from "@/components/PdvControlsBanner";
import { usePdvControls } from "@/contexts/PdvControlsContext";
import { useLicense } from "@/contexts/LicenseContext";
import { LicenseSuspendedScreen } from "@/components/LicenseSuspendedScreen";
import { pdvBlockedMessage } from "@/lib/pdvControls";
import { usePWA } from "@/hooks/usePWA";
import { InstallPWABanner } from "@/components/InstallPWABanner";
import { UpdateNotification } from "@/components/UpdateNotification";
import { usePermissions } from "@/hooks/usePermissions";
import type { AreaKey } from "@/lib/permissions";
import { separateLineItems } from "@/lib/separateLineItems";
import { useStore } from "@/contexts/StoreContext";
import { fetchAllowedCategoryIds } from "@/lib/categoryAccess";
import { ProductComplementsDialog, type ComplementGroupFull } from "@/components/ProductComplementsDialog";
import { splitItemNote } from "@/lib/itemNotes";

interface CartItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface Category {
  id: string;
  name: string;
  image_url?: string;
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  image_url?: string;
  display_order: number;
}

interface Seller {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  commission_rate: number;
  active: boolean;
}

const Index = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("main");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState<string>("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showSaveOrderDialog, setShowSaveOrderDialog] = useState(false);
  const [cartItemNotes, setCartItemNotes] = useState<Record<string, string>>({});
  const [complementProduct, setComplementProduct] = useState<any>(null);
  const [complementGroups, setComplementGroups] = useState<ComplementGroupFull[]>([]);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [editInitialQty, setEditInitialQty] = useState<Record<string, number>>({});
  const [editInitialObs, setEditInitialObs] = useState("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [amountReceived, setAmountReceived] = useState<number | undefined>(undefined);
  const [loadedSaleId, setLoadedSaleId] = useState<string | null>(null);
  const [loadedCustomerName, setLoadedCustomerName] = useState<string>("");
  const [loadedNotes, setLoadedNotes] = useState<string>("");
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [storeInfo, setStoreInfo] = useState<{ name: string; logo: string | null; address: string; phone: string; printer_width: string; printer_font_size: number; printer_show_logo: boolean; printer_show_address: boolean; printer_show_phone: boolean; printer_show_seller: boolean; printer_show_customer: boolean; printer_show_order_number: boolean; printer_show_payment_method: boolean; printer_show_date: boolean; printer_header_text: string; printer_footer_text: string; printer_margin_left: number }>({ name: '', logo: null, address: '', phone: '', printer_width: '58mm', printer_font_size: 10, printer_show_logo: true, printer_show_address: true, printer_show_phone: true, printer_show_seller: true, printer_show_customer: true, printer_show_order_number: true, printer_show_payment_method: true, printer_show_date: true, printer_header_text: '', printer_footer_text: 'Obrigado pela preferência!', printer_margin_left: 0 });
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [pendingRecoveryData, setPendingRecoveryData] = useState<{ items: CartItem[]; customerName: string; discount?: { type: "value" | "percent"; amount: number }; surcharge?: { type: "value" | "percent"; amount: number } } | null>(null);
  const [discount, setDiscount] = useState<{ type: "value" | "percent"; amount: number }>({ type: "value", amount: 0 });
  const [surcharge, setSurcharge] = useState<{ type: "value" | "percent"; amount: number }>({ type: "value", amount: 0 });
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const cartInitialized = useRef(false);
  usePWA();
  const { can, isAdmin, loading: permsLoading } = usePermissions();
  const { isBlocked: isControlBlocked, messageFor: controlMessage } = usePdvControls();
  const { suspended: licenseSuspended } = useLicense();
  const { writeStoreId, scopeStoreId, activeStore, isSuperAdmin } = useStore();
  const storeIdRef = useRef<string | null>(null);
  storeIdRef.current = scopeStoreId ?? writeStoreId;
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeStoreId, writeStoreId]);

  // Guard: redirect operator away from areas they can't access
  useEffect(() => {
    if (permsLoading) return;
    if (currentPage === "main") {
      // Main POS requires 'sales' permission
      if (!can("sales" as AreaKey)) {
        // Fallback to first allowed area
        const fallback = (["pending-sales","catalog","customers","suppliers","sellers","returns","stock","financial","reports","settings"] as AreaKey[]).find((a) => can(a));
        if (fallback) setCurrentPage(fallback);
      }
      return;
    }
    if (!can(currentPage as AreaKey)) {
      if (can("sales" as AreaKey)) setCurrentPage("main");
      else {
        const fallback = (["pending-sales","catalog","customers","suppliers","sellers","returns","stock","financial","reports","settings"] as AreaKey[]).find((a) => can(a));
        setCurrentPage(fallback ?? "main");
      }
    }
  }, [currentPage, permsLoading, can]);

  // Save cart to localStorage whenever it changes
  const saveCartToStorage = useCallback((items: CartItem[], customer: string, disc?: typeof discount, surch?: typeof surcharge) => {
    if (!cartInitialized.current) return;
    if (items.length > 0) {
      localStorage.setItem('pdv_cart', JSON.stringify({ 
        items, 
        customerName: customer, 
        discount: disc || discount, 
        surcharge: surch || surcharge, 
        timestamp: Date.now() 
      }));
    } else {
      localStorage.removeItem('pdv_cart');
    }
  }, [discount, surcharge]);

  // Persist cart on every change
  useEffect(() => {
    saveCartToStorage(cartItems, customerName, discount, surcharge);
  }, [cartItems, customerName, discount, surcharge, saveCartToStorage]);

  useEffect(() => {
    fetchData();
    loadDefaultSeller();
    // Check for saved cart
    checkSavedCart();
  }, []);

  useEffect(() => {
    if (currentPage === "main") {
      fetchData();
    }
  }, [currentPage]);

  // Realtime: refetch when catalog or store settings change
  useEffect(() => {
    const channel = supabase
      .channel('catalog-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInflight = useRef<Promise<void> | null>(null);
  const catalogHydrated = useRef(false);
  if (!catalogHydrated.current) {
    catalogHydrated.current = true;
    try {
      const c = JSON.parse(localStorage.getItem('pdv_catalog_cache') || 'null');
      if (c && Array.isArray(c.categories) && Array.isArray(c.products)) {
        queueMicrotask(() => {
          setCategories((prev: any[]) => (prev.length ? prev : c.categories));
          setProducts((prev: any[]) => (prev.length ? prev : c.products));
          if (c.categories[0]) setActiveCategory((prev: any) => prev || c.categories[0].id);
          if (c.categories.length) setIsLoading(false);
        });
      }
    } catch { /* ignore */ }
  }

  const fetchData = () => {
    if (fetchInflight.current) return fetchInflight.current;
    fetchInflight.current = fetchDataImpl().finally(() => { fetchInflight.current = null; });
    return fetchInflight.current;
  };

  const fetchDataImpl = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      const [categoriesRes, productsRes, storeRes, allowed] = await Promise.all([
        supabase.from('categories').select('*').eq('active', true),
        supabase.from('products').select('*').eq('active', true),
        supabase.from('store_settings').select('store_name, logo_url, address, phone, printer_width, printer_font_size, printer_show_logo, printer_show_address, printer_show_phone, printer_show_seller, printer_show_customer, printer_show_order_number, printer_show_payment_method, printer_show_date, printer_header_text, printer_footer_text, printer_margin_left').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        currentUser ? fetchAllowedCategoryIds(currentUser.id, storeIdRef.current) : Promise.resolve(null),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;

      // Sort categories and products alphabetically
      const fetchedCategories = (categoriesRes.data || []).sort((a, b) => 
        a.name.localeCompare(b.name, 'pt-BR')
      );
      const fetchedProducts = (productsRes.data || []).sort((a, b) => 
        a.name.localeCompare(b.name, 'pt-BR')
      );

      const visibleCategories = allowed ? fetchedCategories.filter((c) => allowed.has(c.id)) : fetchedCategories;
      setCategories(visibleCategories);
      setProducts(fetchedProducts);
      try { localStorage.setItem('pdv_catalog_cache', JSON.stringify({ categories: visibleCategories, products: fetchedProducts })); } catch { /* ignore */ }
      
      if (storeRes.data) {
        const d = storeRes.data as any;
        const storeData = {
          name: d.store_name || 'Sistema PDV',
          logo: d.logo_url,
          address: d.address || '',
          phone: d.phone || '',
          printer_width: d.printer_width || '58mm',
          printer_font_size: d.printer_font_size ?? 10,
          printer_show_logo: d.printer_show_logo ?? true,
          printer_show_address: d.printer_show_address ?? true,
          printer_show_phone: d.printer_show_phone ?? true,
          printer_show_seller: d.printer_show_seller ?? true,
          printer_show_customer: d.printer_show_customer ?? true,
          printer_show_order_number: d.printer_show_order_number ?? true,
          printer_show_payment_method: d.printer_show_payment_method ?? true,
          printer_show_date: d.printer_show_date ?? true,
          printer_header_text: d.printer_header_text || '',
          printer_footer_text: d.printer_footer_text ?? 'Obrigado pela preferência!',
          printer_margin_left: d.printer_margin_left ?? 0,
        };
        console.log('Store info loaded:', storeData);
        setStoreInfo(storeData);
      }
      
      if (fetchedCategories.length > 0) {
        setActiveCategory((prev: any) => prev && fetchedCategories.some((c) => c.id === prev) ? prev : fetchedCategories[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do cardápio",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkSavedCart = async () => {
    try {
      const saved = localStorage.getItem('pdv_cart');
      if (!saved) {
        cartInitialized.current = true;
        return;
      }
      const data = JSON.parse(saved);
      if (data?.items?.length > 0) {
        // Validate products still exist
        const { data: validProducts } = await supabase
          .from('products')
          .select('id')
          .in('id', data.items.map((i: CartItem) => i.productId || i.id))
          .eq('active', true);
        
        const validIds = new Set((validProducts || []).map(p => p.id));
        const validItems = separateLineItems<CartItem>(
          data.items.filter((i: CartItem) => validIds.has(i.productId || i.id))
        );
        
        if (validItems.length > 0) {
          setPendingRecoveryData({ items: validItems, customerName: data.customerName || '', discount: data.discount, surcharge: data.surcharge });
          setShowRecoveryDialog(true);
        } else {
          localStorage.removeItem('pdv_cart');
          cartInitialized.current = true;
        }
      } else {
        localStorage.removeItem('pdv_cart');
        cartInitialized.current = true;
      }
    } catch {
      localStorage.removeItem('pdv_cart');
      cartInitialized.current = true;
    }
  };

  const handleRecoverCart = () => {
    if (pendingRecoveryData) {
      setCartItems(pendingRecoveryData.items);
      setCustomerName(pendingRecoveryData.customerName);
      if (pendingRecoveryData.discount) setDiscount(pendingRecoveryData.discount);
      if (pendingRecoveryData.surcharge) setSurcharge(pendingRecoveryData.surcharge);
      toast({ title: "Venda recuperada!", description: "Os produtos foram restaurados no carrinho." });
    }
    setPendingRecoveryData(null);
    setShowRecoveryDialog(false);
    cartInitialized.current = true;
  };

  const handleDiscardCart = () => {
    localStorage.removeItem('pdv_cart');
    setPendingRecoveryData(null);
    setShowRecoveryDialog(false);
    cartInitialized.current = true;
  };

  const loadDefaultSeller = async () => {
    try {
      const savedSellerId = localStorage.getItem('selectedSellerId');
      
      if (savedSellerId) {
        const { data: seller, error } = await supabase
          .from('sellers')
          .select('*')
          .eq('id', savedSellerId)
          .eq('active', true)
          .maybeSingle();

        if (!error && seller) {
          setSelectedSeller(seller);
          return;
        }
      }

      // If no saved seller or seller not found, get the first active seller
      const { data: sellers, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('active', true)
        .order('name')
        .limit(1);

      if (!error && sellers && sellers.length > 0) {
        setSelectedSeller(sellers[0]);
        localStorage.setItem('selectedSellerId', sellers[0].id);
      }
    } catch (error) {
      console.error('Error loading default seller:', error);
    }
  };

  const handleSellerSelect = (seller: Seller | null) => {
    setSelectedSeller(seller);
    if (seller) {
      localStorage.setItem('selectedSellerId', seller.id);
    } else {
      localStorage.removeItem('selectedSellerId');
    }
  };

  const filteredProducts = products.filter(product => product.category_id === activeCategory);
  const modalProducts = products.filter(product => product.category_id === selectedCategoryId);
  const selectedCategoryName = categories.find(c => c.id === selectedCategoryId)?.name || "";

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    setSelectedCategoryId(categoryId);
    setCategoryModalOpen(true);
  };
  const cartSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = discount.type === "percent" ? (cartSubtotal * discount.amount) / 100 : discount.amount;
  const surchargeAmount = surcharge.type === "percent" ? (cartSubtotal * surcharge.amount) / 100 : surcharge.amount;
  const cartTotal = Math.max(0, cartSubtotal - discountAmount + surchargeAmount);
  const cartItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const loadComplementGroups = async (productId: string): Promise<ComplementGroupFull[]> => {
    const db = supabase as any;
    const { data: links } = await db.from("product_complement_groups").select("group_id, display_order").eq("product_id", productId);
    if (!links || links.length === 0) return [];
    const ids = links.map((l: any) => l.group_id);
    const [{ data: gs }, { data: its }] = await Promise.all([
      db.from("complement_groups").select("*").in("id", ids).eq("active", true).order("display_order"),
      db.from("complement_items").select("*").in("group_id", ids).eq("active", true).order("display_order"),
    ]);
    return (gs || [])
      .map((g: any) => ({ ...g, items: (its || []).filter((i: any) => i.group_id === g.id) }))
      .filter((g: ComplementGroupFull) => g.items.length > 0);
  };

  const addToCart = async (product: any) => {
    const full = await loadComplementGroups(product.id);
    if (full.length > 0) {
      setEditingCartItemId(null);
      setEditInitialQty({});
      setEditInitialObs("");
      setComplementGroups(full);
      setComplementProduct(product);
      return;
    }
    addToCartDirect(product);
  };

  /** Reabre a tela de complementos/observação para editar um item já no carrinho. */
  const openItemEditor = async (cartItem: CartItem) => {
    const productId = cartItem.productId || cartItem.id;
    const product = products.find((p: any) => p.id === productId);
    if (!product) {
      sonnerToast.error("Produto não encontrado", {
        description: "Ele pode ter sido removido do cardápio.",
      });
      return;
    }
    const full = await loadComplementGroups(productId);
    const { complementLines, obs } = splitItemNote(cartItemNotes[cartItem.id] || "");
    const qty: Record<string, number> = {};
    for (const g of full) {
      const prefix = `${g.name}: `;
      for (const i of g.items) {
        const line = complementLines.find((l) => l.startsWith(prefix) && l.endsWith(i.name));
        if (line) {
          const m = /^(\d+)x\s/.exec(line.slice(prefix.length));
          if (m) qty[i.id] = parseInt(m[1], 10);
        }
      }
    }
    setEditingCartItemId(cartItem.id);
    setEditInitialQty(qty);
    setEditInitialObs(obs);
    setComplementGroups(full);
    setComplementProduct(product);
  };

  const addToCartDirect = (product: any, extraPrice = 0, note = "") => {
    // If cart is empty and there's a loaded sale, clear it (starting fresh)
    const resetLoaded = cartItems.length === 0 && loadedSaleId;
    if (resetLoaded) {
      setLoadedSaleId(null);
      setLoadedCustomerName("");
      setLoadedNotes("");
      setCartItemNotes({});
      setCustomerName("");
    }
    
    // Cada clique cria uma linha separada no carrinho (sem agrupar)
    const cartItem: CartItem = {
      id: `${product.id}__${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      productId: product.id,
      name: product.name,
      price: Number(product.price) + extraPrice,
      quantity: 1,
      image: product.image || "/placeholder.svg"
    };
    setCartItems(prev => [...prev, cartItem]);
    if (note) setCartItemNotes(prev => ({ ...(resetLoaded ? {} : prev), [cartItem.id]: note }));

    sonnerToast.success("Produto adicionado!", {
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const deleteLoadedPendingSale = async () => {
    if (!loadedSaleId) return;
    const saleId = loadedSaleId;
    try {
      await supabase.from('sale_items').delete().eq('sale_id', saleId);
      await supabase.from('sales').delete().eq('id', saleId);
      sonnerToast.info("Pedido removido", {
        description: "O pedido em aberto foi excluído porque ficou sem itens.",
      });
    } catch (error) {
      console.error('Erro ao excluir pedido vazio:', error);
    } finally {
      setLoadedSaleId(null);
      setLoadedCustomerName("");
      setLoadedNotes("");
      setCartItemNotes({});
      setCustomerName("");
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    const currentItem = cartItems.find((item) => item.id === id);
    if (!currentItem) return;

    if (quantity <= 0) {
      removeItem(id);
      return;
    }

    if (quantity > currentItem.quantity) {
      const additionalItems = Array.from(
        { length: quantity - currentItem.quantity },
        () => ({
          ...currentItem,
          id: `${currentItem.productId || currentItem.id}__${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          quantity: 1,
        })
      );
      setCartItems((items) => [...items, ...additionalItems]);
      return;
    }

    if (quantity < currentItem.quantity) {
      const separated = separateLineItems([currentItem]);
      const kept = separated.slice(0, quantity);
      setCartItems((items) => items.flatMap((item) => item.id === id ? kept : [item]));
    }
  };

  const removeItem = (id: string) => {
    const remaining = cartItems.filter(item => item.id !== id);
    setCartItems(remaining);
    sonnerToast.error("Produto removido", {
      description: "Item removido do carrinho.",
    });
    if (remaining.length === 0) {
      void deleteLoadedPendingSale();
    }
  };

  const handlePrint = (orderNumber?: number | null, notes?: string, notesMap?: Record<string, string>) => {
    if (cartItems.length === 0) return;
    const validOrderNumber = typeof orderNumber === "number" ? orderNumber : null;
    printSaleReceipt({
      customerName: customerName || "Cliente sem nome",
      sellerName: selectedSeller?.name,
      items: cartItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        note: ((notesMap || cartItemNotes)[item.id] ?? (notesMap || cartItemNotes)[String(item.id).split("__unit-")[0]])?.trim() || undefined,
      })),
      total: cartTotal,
      paymentMethod,
      amountReceived: paymentMethod === "dinheiro" ? amountReceived : undefined,
      date: new Date(),
      orderNumber: validOrderNumber ? String(validOrderNumber).padStart(2, "0") : undefined,
      notes: typeof notes === "string" && notes.trim() ? notes : (loadedNotes?.trim() || undefined),
    });
  };




  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (isControlBlocked("sales")) {
      toast({ title: "Operação bloqueada", description: controlMessage("sales"), variant: "destructive" });
      return;
    }
    if (!loadedSaleId && isControlBlocked("tables")) {
      toast({ title: "Operação bloqueada", description: controlMessage("tables"), variant: "destructive" });
      return;
    }
    setShowPaymentDialog(true);
  };

  const handleConfirmCheckout = async (selectedPayment: string, shouldPrint: boolean, amountReceived?: number) => {
    setPaymentMethod(selectedPayment);
    setAmountReceived(amountReceived);
    await processSale(shouldPrint, amountReceived, selectedPayment);
  };

  const processSale = async (shouldPrint: boolean, amountReceived?: number, salePaymentMethod?: string) => {
    const notesMap = cartItemNotes;
    try {
      const demoUserId = "00000000-0000-0000-0000-000000000000";
      
      if (loadedSaleId) {
        // Update existing sale to completed status — created_at is refreshed so the
        // sale is recorded on the day it is closed, not on the day it was created
        const { data: updatedSale, error: updateError } = await supabase
          .from('sales')
          .update({
            total: cartTotal,
            customer_name: customerName || "Cliente sem nome",
            status: 'completed',
            seller_id: selectedSeller?.id,
            payment_method: salePaymentMethod ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', loadedSaleId)
          .select()
          .maybeSingle();

        if (updateError) throw updateError;

        // Delete old sale items
        await supabase
          .from('sale_items')
          .delete()
          .eq('sale_id', loadedSaleId);

        // Create new sale items
        const saleItems = separateLineItems(cartItems).map(item => ({
          sale_id: loadedSaleId,
          product_id: (item as any).productId || item.id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          notes: (notesMap[item.id] ?? notesMap[String(item.id).split("__unit-")[0]])?.trim() || null
        }));

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems);

        if (itemsError) throw itemsError;

        toast({
          title: "Venda finalizada!",
          description: `Pedido de ${customerName || "Cliente sem nome"} finalizado: R$ ${cartTotal.toFixed(2)}`,
        });

        if (shouldPrint) {
          setTimeout(() => {
            handlePrint(updatedSale?.sale_number, loadedNotes || undefined, notesMap);
          }, 100);
        }
      } else {
        // Create new sale record
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert({
            total: cartTotal,
            customer_name: customerName || "Cliente sem nome",
            user_id: demoUserId,
            seller_id: selectedSeller?.id,
            store_id: writeStoreId!,
            payment_method: salePaymentMethod ?? null
          })
          .select()
          .single();

        if (saleError) throw saleError;

        // Create sale items
        const saleItems = separateLineItems(cartItems).map(item => ({
          sale_id: sale.id,
          product_id: (item as any).productId || item.id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          notes: (notesMap[item.id] ?? notesMap[String(item.id).split("__unit-")[0]])?.trim() || null
        }));

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems);

        if (itemsError) throw itemsError;

        toast({
          title: "Venda finalizada!",
          description: `Total: R$ ${cartTotal.toFixed(2)}`,
        });

        if (shouldPrint) {
          setTimeout(() => {
            handlePrint(sale?.sale_number, loadedNotes || undefined, notesMap);
          }, 100);
        }
      }
      
      // Clear cart AFTER printing
      if (shouldPrint) {
        setTimeout(() => {
          setCartItems([]);
          setCustomerName("");
          setLoadedSaleId(null);
          setLoadedCustomerName("");
          setLoadedNotes("");
          setCartItemNotes({});
          setDiscount({ type: "value", amount: 0 });
          setSurcharge({ type: "value", amount: 0 });
          setIsCartOpen(false);
          setShowPaymentDialog(false);
        }, 500);
      } else {
        setCartItems([]);
        setCustomerName("");
        setLoadedSaleId(null);
        setLoadedCustomerName("");
        setLoadedNotes("");
        setCartItemNotes({});
        setDiscount({ type: "value", amount: 0 });
        setSurcharge({ type: "value", amount: 0 });
        setIsCartOpen(false);
        setShowPaymentDialog(false);
      }
    } catch (error) {
      console.error('Error completing sale:', error);
      const blocked = pdvBlockedMessage(error);
      toast({
        title: blocked ? "Operação bloqueada" : "Erro",
        description: blocked ?? "Falha ao finalizar venda",
        variant: "destructive"
      });
    }
  };

  const handleSaveForLater = async (customerName: string, shouldOverwrite: boolean, existingSaleId?: string, shouldPrint?: boolean, notes?: string, itemNotes?: Record<string, string>) => {
    if (cartItems.length === 0) return;
    if (!(shouldOverwrite && existingSaleId) && isControlBlocked("tables")) {
      toast({ title: "Operação bloqueada", description: controlMessage("tables"), variant: "destructive" });
      return;
    }

    const notesMap = itemNotes || cartItemNotes;
    if (itemNotes) setCartItemNotes(itemNotes);
    
    console.log('Cart items before save:', cartItems);
    
    try {
      const demoUserId = "00000000-0000-0000-0000-000000000000";
      
      if (shouldOverwrite && existingSaleId) {
        // Delete existing sale items first
        await supabase
          .from('sale_items')
          .delete()
          .eq('sale_id', existingSaleId);

        // Update the existing sale
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .update({
            total: cartTotal,
            customer_name: customerName,
            notes: notes || null,
            seller_id: selectedSeller?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSaleId)
          .select()
          .single();

        if (saleError) throw saleError;

        // Create new sale items
        const saleItems = separateLineItems(cartItems).map(item => ({
          sale_id: existingSaleId,
          product_id: (item as any).productId || item.id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          notes: (notesMap[item.id] ?? notesMap[String(item.id).split("__unit-")[0]])?.trim() || null
        }));

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems);

        if (itemsError) throw itemsError;

        toast({
          title: "Pedido atualizado!",
          description: `Pedido de ${customerName} foi atualizado.`,
        });

        if (shouldPrint) {
          setTimeout(() => {
            handlePrint(sale?.sale_number, notes, notesMap);
          }, 100);
        }
      } else {
        // Create new pending sale record
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert({
            total: cartTotal,
            customer_name: customerName,
            notes: notes || null,
            status: 'pending',
            user_id: demoUserId,
            seller_id: selectedSeller?.id,
            store_id: writeStoreId!
          })
          .select()
          .single();

        if (saleError) throw saleError;

        // Create sale items
        const saleItems = separateLineItems(cartItems).map(item => ({
          sale_id: sale.id,
          product_id: (item as any).productId || item.id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          notes: (notesMap[item.id] ?? notesMap[String(item.id).split("__unit-")[0]])?.trim() || null
        }));

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems);

        if (itemsError) throw itemsError;

        toast({
          title: "Pedido salvo!",
          description: `Pedido de ${customerName} salvo em aberto.`,
        });

        if (shouldPrint) {
          setTimeout(() => {
            handlePrint(sale?.sale_number, notes, notesMap);
          }, 100);
        }
      }
      
      // Clear cart AFTER printing
      if (shouldPrint) {
        setTimeout(() => {
          setCartItems([]);
          setCustomerName("");
          setLoadedSaleId(null);
          setLoadedCustomerName("");
          setLoadedNotes("");
          setCartItemNotes({});
          setDiscount({ type: "value", amount: 0 });
          setSurcharge({ type: "value", amount: 0 });
        }, 500);
      } else {
        setCartItems([]);
        setCustomerName("");
        setLoadedSaleId(null);
        setLoadedCustomerName("");
        setLoadedNotes("");
        setCartItemNotes({});
        setDiscount({ type: "value", amount: 0 });
        setSurcharge({ type: "value", amount: 0 });
      }
    } catch (error) {
      console.error('Error saving sale:', error);
      const blocked = pdvBlockedMessage(error);
      toast({
        title: blocked ? "Operação bloqueada" : "Erro",
        description: blocked ?? "Falha ao salvar pedido",
        variant: "destructive"
      });
    }
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const handleBackToMain = () => {
    setCurrentPage("main");
  };

  const loadSaleToCart = (items: any[], saleId: string, customerName: string, itemNotes?: Record<string, string>, saleNotes?: string) => {
    setCartItems(separateLineItems(items));
    setCartItemNotes(itemNotes || {});
    setLoadedNotes(saleNotes || "");
    setLoadedSaleId(saleId);
    setLoadedCustomerName(customerName);
    setCustomerName(customerName);
    setCurrentPage("main");
    setIsCartOpen(true);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "suppliers":
        return <SupplierManagement onBackToMain={handleBackToMain} />;
      case "sellers":
        return <SellerManagement onBackToMain={handleBackToMain} />;
      case "pending-sales":
        return <PendingSales onLoadSale={loadSaleToCart} onBackToMain={handleBackToMain} />;
      case "sales":
        return <SalesHistory onBackToMain={handleBackToMain} />;
      case "returns":
        return <Returns onBackToMain={handleBackToMain} />;
      case "stock":
        return <StockManagement onBackToMain={handleBackToMain} />;
      case "financial":
        return <Financial onBackToMain={handleBackToMain} />;
      case "reports":
        return <Reports onBackToMain={handleBackToMain} />;
      case "customers":
        return <CustomerManagement onBackToMain={handleBackToMain} />;
      case "catalog":
        return <CatalogManagement onBackToMain={handleBackToMain} />;
      case "settings":
        return <Settings onBackToMain={handleBackToMain} />;
      case "subscription":
        return <MySubscription onBackToMain={handleBackToMain} />;
      case "main":
      default:
        return (
          <>
            {/* User and Cart Summary Bar */}
            <div className="bg-card border-b border-border px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 w-full max-w-full overflow-hidden">
              <div className="flex flex-col gap-2 sm:gap-3 w-full">
                {/* Row 1: Seller + Customer */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full">
                  <div className="flex-shrink-0">
                    <SellerSelector
                      selectedSeller={selectedSeller}
                      onSellerSelect={handleSellerSelect}
                      disabled={cartItems.length > 0}
                    />
                  </div>
                  <div className="hidden sm:block h-8 w-px bg-border flex-shrink-0"></div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="bg-accent/50 p-2 rounded-lg flex-shrink-0">
                      <span className="text-accent-foreground font-semibold text-sm">👥</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Nome do cliente"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="font-medium text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground w-full min-w-0 text-sm"
                    />
                  </div>
                </div>
                
                {/* Row 2: Total + Checkout button */}
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="text-left min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      {cartItemsCount > 0 ? `${cartItemsCount} produtos/serviços` : 'Sem produtos/serviços'}
                    </p>
                    <p className="text-base sm:text-lg font-bold text-foreground">R$ {cartTotal.toFixed(2)}</p>
                  </div>
                  <Button 
                    size="lg" 
                    className="px-3 sm:px-6 py-3 sm:py-5 text-xs sm:text-base font-bold text-white flex-shrink-0 disabled:opacity-100 disabled:cursor-not-allowed"
                    style={{ backgroundColor: `hsl(var(--checkout))` }}
                    onClick={handleCheckout}
                    disabled={cartItems.length === 0}
                  >
                    COBRAR<br />R$ {cartTotal.toFixed(2)}
                  </Button>
                </div>
              </div>
            </div>

            {/* Expandable Cart Panel */}
            <ExpandableCartPanel
              items={cartItems}
              onRemoveItem={removeItem}
              onUpdateQuantity={updateQuantity}
              discount={discount}
              surcharge={surcharge}
              onDiscountChange={setDiscount}
              onSurchargeChange={setSurcharge}
              subtotal={cartSubtotal}
              finalTotal={cartTotal}
              itemNotes={cartItemNotes}
              onItemNoteChange={(id, note) =>
                setCartItemNotes((prev) => ({ ...prev, [id]: note }))
              }
              onEditItem={openItemEditor}
            />

            {/* Categories Grid */}
            <main className="w-full max-w-full p-3 sm:p-4 md:p-6 overflow-x-hidden">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="text-lg">Carregando cardápio...</div>
                </div>
              ) : (
                <>
                  {/* Search bar */}
                  <div className="relative mb-4 w-full max-w-2xl mx-auto">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path strokeLinecap="round" d="m20 20-3-3" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Pesquisar produtos ou categorias..."
                      className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                        aria-label="Limpar pesquisa"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {(() => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) {
                      return (
                        <CatalogGrid kind="category">
                          {categories.map((category) => (
                            <CategoryCard
                              key={category.id}
                              name={category.name}
                              image={category.image_url || `/placeholder.svg`}
                              isActive={activeCategory === category.id}
                              onClick={() => handleCategoryClick(category.id)}
                            />
                          ))}
                        </CatalogGrid>
                      );
                    }

                    const matchedCategories = categories.filter((c) =>
                      c.name.toLowerCase().includes(q)
                    );
                    const matchedProducts = products.filter((p) =>
                      p.name.toLowerCase().includes(q) ||
                      (p.description || "").toLowerCase().includes(q)
                    );

                    return (
                      <div className="space-y-6">
                        {matchedCategories.length > 0 && (
                          <section>
                            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                              Categorias ({matchedCategories.length})
                            </h2>
                            <CatalogGrid kind="category">
                              {matchedCategories.map((category) => (
                                <CategoryCard
                                  key={category.id}
                                  name={category.name}
                                  image={category.image_url || `/placeholder.svg`}
                                  isActive={activeCategory === category.id}
                                  onClick={() => handleCategoryClick(category.id)}
                                />
                              ))}
                            </CatalogGrid>
                          </section>
                        )}

                        {matchedProducts.length > 0 && (
                          <section>
                            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                              Produtos ({matchedProducts.length})
                            </h2>
                            <CatalogGrid kind="product">
                              {matchedProducts.map((product) => (
                                <ProductCard
                                  key={product.id}
                                  id={product.id}
                                  name={product.name}
                                  description={product.description || ""}
                                  price={product.price}
                                  image={product.image_url || "/placeholder.svg"}
                                  onAddToCart={addToCart}
                                />
                              ))}
                            </CatalogGrid>
                          </section>
                        )}

                        {matchedCategories.length === 0 && matchedProducts.length === 0 && (
                          <div className="text-center py-10 text-muted-foreground">
                            Nenhum resultado encontrado para "{searchQuery}".
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Category Products Modal */}
                  <CategoryProductsModal
                    isOpen={categoryModalOpen}
                    onClose={() => setCategoryModalOpen(false)}
                    categoryName={selectedCategoryName}
                    products={modalProducts}
                    onAddToCart={addToCart}
                  />
                  <ProductComplementsDialog
                    product={complementProduct}
                    groups={complementGroups}
                    initialQuantities={editInitialQty}
                    initialObs={editInitialObs}
                    confirmLabel={editingCartItemId ? "Salvar alterações" : undefined}
                    onClose={() => { setComplementProduct(null); setEditingCartItemId(null); }}
                    onConfirm={(extra, note) => {
                      if (editingCartItemId) {
                        const id = editingCartItemId;
                        setCartItems((prev) =>
                          prev.map((it) =>
                            it.id === id ? { ...it, price: Number(complementProduct.price) + extra } : it
                          )
                        );
                        setCartItemNotes((prev) => {
                          const next = { ...prev };
                          if (note) next[id] = note; else delete next[id];
                          return next;
                        });
                        sonnerToast.success("Item atualizado!", {
                          description: `${complementProduct.name} foi atualizado no carrinho.`,
                        });
                      } else {
                        addToCartDirect(complementProduct, extra, note);
                      }
                      setComplementProduct(null);
                      setEditingCartItemId(null);
                    }}
                  />

                </>
              )}
            </main>

            {/* Botão flutuante do carrinho */}
            {cartItems.length > 0 && (
              <div className="fixed bottom-4 right-4 z-40">
                <Button 
                  size="lg" 
                  aria-label="Abrir carrinho"
                  className="relative rounded-full h-14 w-14 bg-warning hover:bg-warning/90 shadow-large"
                  onClick={() => setIsCartOpen(true)}
                >
                  <span className="text-2xl">🛒</span>
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {cartItemsCount}
                  </span>
                </Button>
              </div>
            )}

          </>
        );
    }
  };

  // Painel Master suspended the license: only Minha Assinatura stays available.
  if (licenseSuspended) {
    return (
      <ThemeProvider>
        <LicenseSuspendedScreen canOpenSubscription={!permsLoading && can("subscription")} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen min-h-[100dvh] bg-background w-full max-w-full overflow-x-hidden">
        <PDVHeader 
          cartItemsCount={cartItemsCount} 
          total={cartTotal} 
          onMenuClick={() => setIsSidebarOpen(true)}
          onCartClick={() => setIsCartOpen(true)}
          onSaveOrderClick={() => setShowSaveOrderDialog(true)}
          selectedSeller={selectedSeller}
        />
        <PdvControlsBanner />
        
        <SidebarMenu 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onNavigate={handleNavigate}
        />
        
        {/* Cart Drawer */}
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Carrinho de Compras</SheetTitle>
            </SheetHeader>
            <div className="mt-6 h-full">
              <Cart
                items={cartItems}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                onCheckout={handleCheckout}
                onSaveForLater={handleSaveForLater}
                onPrintReceipt={handlePrint}
                loadedSaleId={loadedSaleId}
                loadedCustomerName={loadedCustomerName}
                loadedNotes={loadedNotes}
                itemNotes={cartItemNotes}
                onItemNoteChange={(id, note) =>
                  setCartItemNotes((prev) => ({ ...prev, [id]: note }))
                }
                onEditItem={openItemEditor}

              />
            </div>
          </SheetContent>
        </Sheet>
        
        {renderCurrentPage()}
        
        {/* Hidden Print Receipt */}
        <div style={{ display: 'none' }}>
          <PrintReceipt
            ref={printRef}
            customerName={customerName || "Cliente sem nome"}
            sellerName={selectedSeller?.name}
            items={cartItems.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              total: item.price * item.quantity
            }))}
            total={cartTotal}
            paymentMethod={paymentMethod}
            date={new Date()}
            storeName={storeInfo.name}
            storeLogo={storeInfo.logo}
            storeAddress={storeInfo.address}
            storePhone={storeInfo.phone}
            printerWidth={storeInfo.printer_width}
            printerFontSize={storeInfo.printer_font_size}
            printerShowLogo={storeInfo.printer_show_logo}
            printerShowAddress={storeInfo.printer_show_address}
            printerShowPhone={storeInfo.printer_show_phone}
            printerShowSeller={storeInfo.printer_show_seller}
            printerShowCustomer={storeInfo.printer_show_customer}
            printerShowOrderNumber={storeInfo.printer_show_order_number}
            printerShowPaymentMethod={storeInfo.printer_show_payment_method}
            printerShowDate={storeInfo.printer_show_date}
            printerHeaderText={storeInfo.printer_header_text}
            printerFooterText={storeInfo.printer_footer_text}
            printerMarginLeft={storeInfo.printer_margin_left}
          />
        </div>

        {/* Payment Method Dialog */}
        <PaymentMethodDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          onConfirm={handleConfirmCheckout}
          total={cartTotal}
        />

        {/* Cart Recovery Dialog */}
        <AlertDialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Venda em andamento encontrada</AlertDialogTitle>
              <AlertDialogDescription>
                Foi encontrada uma venda com {pendingRecoveryData?.items.length || 0} produto(s) no carrinho.
                {pendingRecoveryData?.customerName && (
                  <> Cliente: <strong>{pendingRecoveryData.customerName}</strong>.</>
                )}
                {' '}Deseja continuar esta venda?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDiscardCart}>Cancelar venda</AlertDialogCancel>
              <AlertDialogAction onClick={handleRecoverCart}>Continuar venda</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <SaveOrderDialog
          open={showSaveOrderDialog}
          onOpenChange={setShowSaveOrderDialog}
          onSave={handleSaveForLater}
          items={cartItems}
          loadedSaleId={loadedSaleId}
          loadedCustomerName={loadedCustomerName}
          loadedNotes={loadedNotes}
          initialItemNotes={cartItemNotes}
        />

        <InstallPWABanner />
        <UpdateNotification />
      </div>
    </ThemeProvider>
  );
};

export default Index;