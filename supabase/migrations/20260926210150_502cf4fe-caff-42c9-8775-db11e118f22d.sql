CREATE TABLE public.seller_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, store_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_stores TO authenticated;
GRANT ALL ON public.seller_stores TO service_role;
ALTER TABLE public.seller_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View seller links of accessible stores" ON public.seller_stores FOR SELECT TO authenticated
  USING (public.can_access_store(auth.uid(), store_id));
CREATE POLICY "Admins manage seller links" ON public.seller_stores FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
INSERT INTO public.seller_stores (seller_id, store_id)
SELECT s.id, st.id FROM public.sellers s JOIN public.stores st
  ON (s.store_id IS NULL OR st.id = s.store_id)
ON CONFLICT DO NOTHING;