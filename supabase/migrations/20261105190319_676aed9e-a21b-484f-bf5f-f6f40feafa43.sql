ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS gradient_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS gradient_color text DEFAULT '#8b5cf6';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS gradient_direction text DEFAULT '135deg';
NOTIFY pgrst, 'reload schema';