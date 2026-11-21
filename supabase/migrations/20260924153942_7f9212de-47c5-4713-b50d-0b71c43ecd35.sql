CREATE TABLE public.user_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_stores TO authenticated;
GRANT ALL ON public.user_stores TO service_role;
ALTER TABLE public.user_stores ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_stores_user ON public.user_stores(user_id);
CREATE INDEX idx_user_stores_store ON public.user_stores(store_id);

INSERT INTO public.user_stores (user_id, store_id)
SELECT user_id, store_id FROM public.profiles WHERE store_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_access_store(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_super_admin(_user_id)
    OR _store_id IS NULL
    OR EXISTS (SELECT 1 FROM public.user_stores WHERE user_id = _user_id AND store_id = _store_id)
  )
$$;

CREATE POLICY "View own store links or admin" ON public.user_stores FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admin inserts store links" ON public.user_stores FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Admin updates store links" ON public.user_stores FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Admin deletes store links" ON public.user_stores FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));