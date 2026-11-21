CREATE TABLE public.store_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id text NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_categories TO authenticated;
GRANT ALL ON public.store_categories TO service_role;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View store categories" ON public.store_categories FOR SELECT TO authenticated USING (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Super admin manages store categories" ON public.store_categories FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.user_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id text NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_categories TO authenticated;
GRANT ALL ON public.user_categories TO service_role;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own user categories" ON public.user_categories FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin manages user categories" ON public.user_categories FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));