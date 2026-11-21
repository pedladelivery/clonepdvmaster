-- ============ FUNÇÕES BASE ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'operator',
  permissions JSONB NOT NULL DEFAULT '{"sales":true,"pending_sales":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Profile updates with role protection" ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR auth.uid() = user_id)
WITH CHECK (
  public.is_admin(auth.uid())
  OR (auth.uid() = user_id AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid()))
);
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuário'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can modify categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update categories" ON public.categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete categories" ON public.categories FOR DELETE TO authenticated USING (true);

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category_id TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete products" ON public.products FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CUSTOMERS / SUPPLIERS / SELLERS ============
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, email TEXT, phone TEXT, birth_date DATE, address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, contact_person TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.sellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, email TEXT, phone TEXT,
  commission_rate NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage sellers" ON public.sellers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SALES ============
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  seller_id UUID REFERENCES public.sellers(id),
  sale_number INTEGER,
  customer_name TEXT,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage sale_items" ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ NUMERAÇÃO SEQUENCIAL DE VENDAS ============
CREATE TABLE IF NOT EXISTS public.sale_number_sequence (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.sale_number_sequence TO authenticated;
GRANT ALL ON public.sale_number_sequence TO service_role;
ALTER TABLE public.sale_number_sequence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sale_number_sequence" ON public.sale_number_sequence FOR SELECT TO authenticated USING (true);
INSERT INTO public.sale_number_sequence (id, last_number) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_next_sale_number()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_num INTEGER;
BEGIN
  UPDATE sale_number_sequence SET last_number = last_number + 1, updated_at = now()
  WHERE id = 1 RETURNING last_number INTO next_num;
  RETURN next_num;
END; $$;

CREATE OR REPLACE FUNCTION public.assign_sale_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sale_number IS NULL THEN NEW.sale_number := get_next_sale_number(); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_assign_sale_number ON public.sales;
CREATE TRIGGER trg_assign_sale_number BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.assign_sale_number();

-- ============ ESTOQUE / FINANCEIRO / DEVOLUÇÕES ============
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage stock_movements" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage transactions" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view returns" ON public.returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert returns" ON public.returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update returns" ON public.returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete returns" ON public.returns FOR DELETE TO authenticated USING (true);

-- ============ CONFIGURAÇÕES DA LOJA ============
CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  cnpj TEXT,
  opening_hours TEXT,
  notifications_enabled BOOLEAN DEFAULT true,
  auto_backup BOOLEAN DEFAULT true,
  low_stock_alert BOOLEAN DEFAULT true,
  min_stock_threshold INTEGER DEFAULT 5,
  logo_url TEXT,
  logo_size INTEGER DEFAULT 32,
  primary_color TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  accent_color TEXT DEFAULT '#06b6d4',
  background_color TEXT DEFAULT '#ffffff',
  checkout_color TEXT DEFAULT '#22c55e',
  store_name_size INTEGER DEFAULT 20,
  subtitle_size INTEGER DEFAULT 12,
  subtitle_text TEXT DEFAULT 'Sistema de Vendas',
  menu_icon_size INTEGER DEFAULT 32,
  category_name_size INTEGER DEFAULT 14,
  category_name_color TEXT DEFAULT '#1f2937',
  category_name_bg TEXT DEFAULT '#f3f4f6',
  product_name_size INTEGER DEFAULT 14,
  product_name_color TEXT DEFAULT '#1f2937',
  product_name_bg TEXT DEFAULT '#ffffff',
  pwa_name TEXT DEFAULT 'RestaurPOS',
  pwa_short_name TEXT DEFAULT 'RestaurPOS',
  pwa_description TEXT DEFAULT 'Sistema completo de ponto de venda',
  pwa_icon_url TEXT,
  pwa_theme_color TEXT DEFAULT '#6366f1',
  pwa_background_color TEXT DEFAULT '#ffffff',
  pwa_orientation TEXT DEFAULT 'portrait',
  printer_width TEXT DEFAULT '58mm',
  printer_font_size INTEGER DEFAULT 10,
  printer_margin_left INTEGER NOT NULL DEFAULT 0,
  printer_show_logo BOOLEAN DEFAULT true,
  printer_show_address BOOLEAN DEFAULT true,
  printer_show_phone BOOLEAN DEFAULT true,
  printer_show_seller BOOLEAN DEFAULT true,
  printer_show_customer BOOLEAN DEFAULT true,
  printer_show_order_number BOOLEAN DEFAULT true,
  printer_show_payment_method BOOLEAN DEFAULT true,
  printer_show_date BOOLEAN DEFAULT true,
  printer_header_text TEXT DEFAULT '',
  printer_footer_text TEXT DEFAULT 'Obrigado pela preferência!',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view store settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Admins can insert store settings" ON public.store_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update store settings" ON public.store_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete store settings" ON public.store_settings FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.store_settings (store_name) SELECT 'Minha Loja'
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);

-- ============ REALTIME ============
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.store_settings REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.categories; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============ PERMISSÕES DE EXECUÇÃO ============
REVOKE EXECUTE ON FUNCTION public.get_next_sale_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_sale_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- ============ CATÁLOGO INICIAL ============
INSERT INTO public.categories (id, name, image_url, display_order) VALUES
('lanches','Lanches','/assets/category-lanches.jpg',1),
('almoco','Almoço','/assets/category-almoco.jpg',2),
('bebidas','Bebidas','/assets/category-bebidas.jpg',3),
('sobremesas','Sobremesas','/assets/category-sobremesas.jpg',4)
ON CONFLICT (id) DO NOTHING;