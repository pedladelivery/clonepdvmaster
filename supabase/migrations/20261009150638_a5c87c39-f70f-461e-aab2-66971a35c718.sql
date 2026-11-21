DROP POLICY IF EXISTS "Auth can view pix settings" ON public.pix_settings;
CREATE POLICY "Store members view pix settings" ON public.pix_settings FOR SELECT TO authenticated USING (public.can_access_store(auth.uid(), store_id));
DROP POLICY IF EXISTS "Auth can view payment methods" ON public.payment_methods;
CREATE POLICY "Store members view payment methods" ON public.payment_methods FOR SELECT TO authenticated USING (public.can_access_store(auth.uid(), store_id));
DROP POLICY IF EXISTS "Anyone can view store_products" ON public.store_products;
CREATE POLICY "Store members view store_products" ON public.store_products FOR SELECT TO authenticated USING (public.can_access_store(auth.uid(), store_id));

DROP POLICY IF EXISTS "Public Access for catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
CREATE POLICY "Signed-in view catalog images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'catalog-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in view logos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can upload catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

CREATE POLICY "Catalog editors upload catalog images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'catalog-images' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND (p.role = 'admin' OR (p.permissions->>'catalog')::boolean IS TRUE)));
CREATE POLICY "Catalog editors update catalog images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'catalog-images' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND (p.role = 'admin' OR (p.permissions->>'catalog')::boolean IS TRUE)));
CREATE POLICY "Catalog editors delete catalog images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'catalog-images' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND (p.role = 'admin' OR (p.permissions->>'catalog')::boolean IS TRUE)));
CREATE POLICY "Settings editors upload logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND (p.role = 'admin' OR (p.permissions->>'settings')::boolean IS TRUE)));
CREATE POLICY "Settings editors update logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND (p.role = 'admin' OR (p.permissions->>'settings')::boolean IS TRUE)));
CREATE POLICY "Settings editors delete logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND (p.role = 'admin' OR (p.permissions->>'settings')::boolean IS TRUE)));