-- Drop existing restrictive policies and create permissive ones for demo
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;

-- Categories: allow all operations for demo
CREATE POLICY "Allow all categories operations for demo"
ON public.categories
FOR ALL
USING (true)
WITH CHECK (true);

-- Products: allow all operations for demo
CREATE POLICY "Allow all products operations for demo"
ON public.products
FOR ALL
USING (true)
WITH CHECK (true);