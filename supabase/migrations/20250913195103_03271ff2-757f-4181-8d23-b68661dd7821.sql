-- Open up categories and products for demo to allow updates from the frontend without auth
-- NOTE: These policies are permissive for demo purposes. Consider tightening for production.

-- Categories: allow all operations
CREATE POLICY IF NOT EXISTS "Allow all categories operations for demo"
ON public.categories
FOR ALL
USING (true)
WITH CHECK (true);

-- Products: allow all operations
CREATE POLICY IF NOT EXISTS "Allow all products operations for demo"
ON public.products
FOR ALL
USING (true)
WITH CHECK (true);
