ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS pwa_name text DEFAULT 'RestaurPOS',
  ADD COLUMN IF NOT EXISTS pwa_short_name text DEFAULT 'RestaurPOS',
  ADD COLUMN IF NOT EXISTS pwa_description text DEFAULT 'Sistema completo de ponto de venda',
  ADD COLUMN IF NOT EXISTS pwa_icon_url text,
  ADD COLUMN IF NOT EXISTS pwa_theme_color text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS pwa_background_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS pwa_orientation text DEFAULT 'portrait';