
-- Lock down business tables to authenticated users only
DROP POLICY IF EXISTS "Allow all sales operations for demo" ON public.sales;
CREATE POLICY "Authenticated users can manage sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all sale items operations for demo" ON public.sale_items;
CREATE POLICY "Authenticated users can manage sale_items" ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all stock movements operations for demo" ON public.stock_movements;
CREATE POLICY "Authenticated users can manage stock_movements" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all transactions operations for demo" ON public.transactions;
CREATE POLICY "Authenticated users can manage transactions" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage customers" ON public.customers;
CREATE POLICY "Authenticated users can manage customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage sellers" ON public.sellers;
CREATE POLICY "Authenticated users can manage sellers" ON public.sellers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users can manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sale number sequence" ON public.sale_number_sequence;
CREATE POLICY "Authenticated users can read sale_number_sequence" ON public.sale_number_sequence FOR SELECT TO authenticated USING (true);
-- Sale numbers are assigned by SECURITY DEFINER function get_next_sale_number; no direct write needed

-- Categories and products: keep SELECT public (catalog browsing), restrict writes to authenticated
DROP POLICY IF EXISTS "Allow all categories operations for demo" ON public.categories;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can modify categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update categories" ON public.categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete categories" ON public.categories FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all products operations for demo" ON public.products;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete products" ON public.products FOR DELETE TO authenticated USING (true);

-- Storage: lock down logo and catalog-images writes to authenticated
DROP POLICY IF EXISTS "Users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Authenticated users can update logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');
CREATE POLICY "Authenticated users can delete logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Users can upload catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete catalog images" ON storage.objects;
-- Existing "Authenticated users can upload/update/delete catalog images" policies remain
