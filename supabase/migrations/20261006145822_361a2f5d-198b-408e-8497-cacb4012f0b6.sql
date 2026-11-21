ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.pix_settings ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_code_store_uniq ON public.payment_methods (code, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE UNIQUE INDEX IF NOT EXISTS pix_settings_store_uniq ON public.pix_settings (COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid));