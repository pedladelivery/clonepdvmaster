DROP POLICY IF EXISTS "Authenticated users can view store settings" ON public.store_settings;
CREATE POLICY "Anyone can view store settings"
  ON public.store_settings
  FOR SELECT
  USING (true);