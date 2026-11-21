ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_name_size integer DEFAULT 20;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS subtitle_size integer DEFAULT 12;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS menu_icon_size integer DEFAULT 32;