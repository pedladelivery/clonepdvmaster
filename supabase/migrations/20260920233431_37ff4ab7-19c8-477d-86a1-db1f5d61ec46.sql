
-- 1. stores
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  slug text UNIQUE,
  address text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view stores" ON public.stores;
CREATE POLICY "Anyone can view stores" ON public.stores FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage stores" ON public.stores;
CREATE POLICY "Admins manage stores" ON public.stores FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP TRIGGER IF EXISTS update_stores_updated_at ON public.stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Loja 1 a partir das configurações atuais + lojas 2 e 3
INSERT INTO public.stores (name, code, slug, address, phone)
SELECT COALESCE(NULLIF(trim(s.store_name), ''), 'Loja 1'), 'L1', 'loja-1', s.address, s.phone
FROM (SELECT store_name, address, phone FROM public.store_settings ORDER BY created_at LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM public.stores)
UNION ALL
SELECT 'Loja 1', 'L1', 'loja-1', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.stores) AND NOT EXISTS (SELECT 1 FROM public.store_settings);

INSERT INTO public.stores (name, code, slug)
SELECT v.name, v.code, v.slug FROM (VALUES ('Loja 2','L2','loja-2'), ('Loja 3','L3','loja-3')) AS v(name, code, slug)
WHERE NOT EXISTS (SELECT 1 FROM public.stores st WHERE st.code = v.code);

-- 3. store_id nas tabelas operacionais
ALTER TABLE public.sales            ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.stock_movements  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.transactions     ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.customers        ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.sellers          ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.suppliers        ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.profiles         ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.store_settings   ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

-- 4. backfill: tudo que existe pertence à Loja 1
DO $$
DECLARE l1 uuid;
BEGIN
  SELECT id INTO l1 FROM public.stores WHERE code = 'L1';
  UPDATE public.sales           SET store_id = l1 WHERE store_id IS NULL;
  UPDATE public.stock_movements SET store_id = l1 WHERE store_id IS NULL;
  UPDATE public.transactions    SET store_id = l1 WHERE store_id IS NULL;
  UPDATE public.customers       SET store_id = l1 WHERE store_id IS NULL;
  UPDATE public.sellers         SET store_id = l1 WHERE store_id IS NULL;
  UPDATE public.suppliers       SET store_id = l1 WHERE store_id IS NULL;
  UPDATE public.store_settings  SET store_id = l1 WHERE store_id IS NULL;
  UPDATE public.profiles        SET store_id = l1 WHERE store_id IS NULL AND role <> 'admin';
END $$;

ALTER TABLE public.sales           ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.stock_movements ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.transactions    ALTER COLUMN store_id SET NOT NULL;

-- 5. estoque por loja
CREATE TABLE IF NOT EXISTS public.store_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_stock TO authenticated;
GRANT ALL ON public.store_stock TO service_role;
ALTER TABLE public.store_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage store_stock" ON public.store_stock;
CREATE POLICY "Authenticated manage store_stock" ON public.store_stock FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS update_store_stock_updated_at ON public.store_stock;
CREATE TRIGGER update_store_stock_updated_at BEFORE UPDATE ON public.store_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.store_stock (store_id, product_id, stock_quantity, min_stock)
SELECT (SELECT id FROM public.stores WHERE code = 'L1'), p.id,
       COALESCE(p.stock_quantity, 0), COALESCE(p.min_stock, 0)
FROM public.products p
ON CONFLICT (store_id, product_id) DO NOTHING;

-- 6. disponibilidade / preço por loja (preparação, fica vazia)
CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  available boolean NOT NULL DEFAULT true,
  price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id)
);
GRANT SELECT ON public.store_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_products TO authenticated;
GRANT ALL ON public.store_products TO service_role;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view store_products" ON public.store_products;
CREATE POLICY "Anyone can view store_products" ON public.store_products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage store_products" ON public.store_products;
CREATE POLICY "Admins manage store_products" ON public.store_products FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP TRIGGER IF EXISTS update_store_products_updated_at ON public.store_products;
CREATE TRIGGER update_store_products_updated_at BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. numeração de vendas por loja
ALTER TABLE public.sale_number_sequence ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);
ALTER TABLE public.sale_number_sequence DROP CONSTRAINT IF EXISTS single_row;
ALTER TABLE public.sale_number_sequence ALTER COLUMN id SET DEFAULT nextval(pg_get_serial_sequence('public.sale_number_sequence','id'));
UPDATE public.sale_number_sequence SET store_id = (SELECT id FROM public.stores WHERE code = 'L1') WHERE store_id IS NULL;
DELETE FROM public.sale_number_sequence WHERE store_id IS NULL;
ALTER TABLE public.sale_number_sequence ALTER COLUMN store_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sale_number_sequence_store_uidx ON public.sale_number_sequence(store_id);

INSERT INTO public.sale_number_sequence (id, store_id, last_number)
SELECT COALESCE((SELECT MAX(id) FROM public.sale_number_sequence), 0) + row_number() OVER (ORDER BY st.code), st.id, 0
FROM public.stores st
WHERE NOT EXISTS (SELECT 1 FROM public.sale_number_sequence s WHERE s.store_id = st.id);

CREATE OR REPLACE FUNCTION public.get_next_sale_number(_store_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO sale_number_sequence (id, store_id, last_number)
  SELECT COALESCE((SELECT MAX(id) FROM sale_number_sequence), 0) + 1, _store_id, 0
  WHERE NOT EXISTS (SELECT 1 FROM sale_number_sequence WHERE store_id = _store_id);

  UPDATE sale_number_sequence SET last_number = last_number + 1, updated_at = now()
  WHERE store_id = _store_id RETURNING last_number INTO next_num;
  RETURN next_num;
END; $$;

CREATE OR REPLACE FUNCTION public.assign_sale_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.sale_number IS NULL THEN NEW.sale_number := get_next_sale_number(NEW.store_id); END IF;
  RETURN NEW;
END; $$;

-- 8. índices
CREATE INDEX IF NOT EXISTS sales_store_created_idx ON public.sales(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_store_status_idx ON public.sales(store_id, status);
CREATE INDEX IF NOT EXISTS sales_user_idx ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS stock_movements_store_created_idx ON public.stock_movements(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_store_date_idx ON public.transactions(store_id, date DESC);
CREATE INDEX IF NOT EXISTS customers_store_idx ON public.customers(store_id);
CREATE INDEX IF NOT EXISTS sellers_store_idx ON public.sellers(store_id);
CREATE INDEX IF NOT EXISTS suppliers_store_idx ON public.suppliers(store_id);
CREATE INDEX IF NOT EXISTS profiles_store_idx ON public.profiles(store_id);
CREATE INDEX IF NOT EXISTS store_stock_store_idx ON public.store_stock(store_id);
