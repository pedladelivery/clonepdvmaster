DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
CREATE POLICY "Anyone can view logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
CREATE POLICY "Authenticated users can update logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Public Access for catalog images" ON storage.objects;
CREATE POLICY "Public Access for catalog images" ON storage.objects FOR SELECT USING (bucket_id = 'catalog-images');
DROP POLICY IF EXISTS "Authenticated users can upload catalog images" ON storage.objects;
CREATE POLICY "Authenticated users can upload catalog images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'catalog-images');
DROP POLICY IF EXISTS "Authenticated users can update catalog images" ON storage.objects;
CREATE POLICY "Authenticated users can update catalog images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'catalog-images');
DROP POLICY IF EXISTS "Authenticated users can delete catalog images" ON storage.objects;
CREATE POLICY "Authenticated users can delete catalog images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'catalog-images');

DROP POLICY IF EXISTS "Authenticated can read public realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can read public realtime topics" ON realtime.messages
FOR SELECT TO authenticated
USING (realtime.topic() IN ('products', 'categories', 'store_settings'));