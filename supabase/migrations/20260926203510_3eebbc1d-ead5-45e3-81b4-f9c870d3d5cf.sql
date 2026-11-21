CREATE TABLE public.complement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  min_select integer NOT NULL DEFAULT 0,
  max_select integer NOT NULL DEFAULT 1,
  required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.complement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.complement_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_complement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.complement_groups(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, group_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complement_groups, public.complement_items, public.product_complement_groups TO authenticated;
GRANT ALL ON public.complement_groups, public.complement_items, public.product_complement_groups TO service_role;
ALTER TABLE public.complement_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_complement_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read groups" ON public.complement_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage groups" ON public.complement_groups FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "read items" ON public.complement_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage items" ON public.complement_items FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "read links" ON public.product_complement_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage links" ON public.product_complement_groups FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER update_complement_groups_updated_at BEFORE UPDATE ON public.complement_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_complement_items_updated_at BEFORE UPDATE ON public.complement_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();