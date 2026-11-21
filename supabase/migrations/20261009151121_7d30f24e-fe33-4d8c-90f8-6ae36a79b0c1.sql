DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
CREATE POLICY "Admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Admins update products" ON public.products FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can modify categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
CREATE POLICY "Admins insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Admins update categories" ON public.categories FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Admins delete categories" ON public.categories FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view stores" ON public.stores;
CREATE POLICY "Members view their stores" ON public.stores FOR SELECT TO authenticated USING (public.can_access_store(auth.uid(), id));

DROP POLICY IF EXISTS "Anyone can view store settings" ON public.store_settings;
CREATE POLICY "Members view store settings" ON public.store_settings FOR SELECT TO authenticated USING (public.can_access_store(auth.uid(), store_id));