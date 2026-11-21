ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS cart_icon_size integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS save_icon_size integer NOT NULL DEFAULT 24;