ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS category_name_size integer DEFAULT 14,
  ADD COLUMN IF NOT EXISTS category_name_color text DEFAULT '#1f2937',
  ADD COLUMN IF NOT EXISTS category_name_bg text DEFAULT '#f3f4f6',
  ADD COLUMN IF NOT EXISTS product_name_size integer DEFAULT 14,
  ADD COLUMN IF NOT EXISTS product_name_color text DEFAULT '#1f2937',
  ADD COLUMN IF NOT EXISTS product_name_bg text DEFAULT '#ffffff';