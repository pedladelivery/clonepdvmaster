
-- ===== Funções auxiliares =====
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.user_store_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_access_store(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_super_admin(_user_id)
    OR _store_id IS NULL
    OR _store_id = public.user_store_id(_user_id)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_store_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_store(uuid, uuid) FROM anon;

-- ===== SALES =====
DROP POLICY IF EXISTS "Authenticated users can manage sales" ON public.sales;
CREATE POLICY "Store scoped sales select" ON public.sales FOR SELECT TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped sales insert" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped sales update" ON public.sales FOR UPDATE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id))
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped sales delete" ON public.sales FOR DELETE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));

-- ===== SALE_ITEMS (via venda) =====
DROP POLICY IF EXISTS "Authenticated users can manage sale_items" ON public.sale_items;
CREATE POLICY "Store scoped sale_items select" ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)));
CREATE POLICY "Store scoped sale_items insert" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)));
CREATE POLICY "Store scoped sale_items update" ON public.sale_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)));
CREATE POLICY "Store scoped sale_items delete" ON public.sale_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)));

-- ===== RETURNS (via venda) =====
DROP POLICY IF EXISTS "Authenticated users can view returns" ON public.returns;
DROP POLICY IF EXISTS "Authenticated users can insert returns" ON public.returns;
DROP POLICY IF EXISTS "Authenticated users can update returns" ON public.returns;
DROP POLICY IF EXISTS "Authenticated users can delete returns" ON public.returns;
CREATE POLICY "Store scoped returns select" ON public.returns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)));
CREATE POLICY "Store scoped returns insert" ON public.returns FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)));
CREATE POLICY "Store scoped returns update" ON public.returns FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)));
CREATE POLICY "Store scoped returns delete" ON public.returns FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.can_access_store(auth.uid(), s.store_id)));

-- ===== STOCK_MOVEMENTS =====
DROP POLICY IF EXISTS "Authenticated users can manage stock_movements" ON public.stock_movements;
CREATE POLICY "Store scoped stock_movements select" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped stock_movements insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped stock_movements update" ON public.stock_movements FOR UPDATE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id))
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped stock_movements delete" ON public.stock_movements FOR DELETE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));

-- ===== STORE_STOCK =====
DROP POLICY IF EXISTS "Authenticated manage store_stock" ON public.store_stock;
CREATE POLICY "Store scoped store_stock select" ON public.store_stock FOR SELECT TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped store_stock insert" ON public.store_stock FOR INSERT TO authenticated
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped store_stock update" ON public.store_stock FOR UPDATE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id))
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped store_stock delete" ON public.store_stock FOR DELETE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));

-- ===== TRANSACTIONS =====
DROP POLICY IF EXISTS "Authenticated users can manage transactions" ON public.transactions;
CREATE POLICY "Store scoped transactions select" ON public.transactions FOR SELECT TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped transactions insert" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped transactions update" ON public.transactions FOR UPDATE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id))
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped transactions delete" ON public.transactions FOR DELETE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));

-- ===== CUSTOMERS =====
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;
CREATE POLICY "Store scoped customers select" ON public.customers FOR SELECT TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped customers insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped customers update" ON public.customers FOR UPDATE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id))
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped customers delete" ON public.customers FOR DELETE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));

-- ===== SELLERS =====
DROP POLICY IF EXISTS "Authenticated users can manage sellers" ON public.sellers;
CREATE POLICY "Store scoped sellers select" ON public.sellers FOR SELECT TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped sellers insert" ON public.sellers FOR INSERT TO authenticated
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped sellers update" ON public.sellers FOR UPDATE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id))
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped sellers delete" ON public.sellers FOR DELETE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));

-- ===== SUPPLIERS =====
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;
CREATE POLICY "Store scoped suppliers select" ON public.suppliers FOR SELECT TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped suppliers insert" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped suppliers update" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id))
  WITH CHECK (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Store scoped suppliers delete" ON public.suppliers FOR DELETE TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));

-- ===== PROFILES =====
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Store scoped profiles select" ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
    OR store_id = public.user_store_id(auth.uid())
  );

-- ===== SALE_NUMBER_SEQUENCE =====
DROP POLICY IF EXISTS "Authenticated users can read sale_number_sequence" ON public.sale_number_sequence;
CREATE POLICY "Store scoped sale_number_sequence select" ON public.sale_number_sequence FOR SELECT TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));

-- ===== ÍNDICES =====
CREATE INDEX IF NOT EXISTS idx_sales_store_created ON public.sales (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales (status);
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales (user_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_store_created ON public.stock_movements (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_store_date ON public.transactions (store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_store_stock_store ON public.store_stock (store_id);
CREATE INDEX IF NOT EXISTS idx_customers_store ON public.customers (store_id);
CREATE INDEX IF NOT EXISTS idx_sellers_store ON public.sellers (store_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_store ON public.suppliers (store_id);
CREATE INDEX IF NOT EXISTS idx_profiles_store ON public.profiles (store_id);
