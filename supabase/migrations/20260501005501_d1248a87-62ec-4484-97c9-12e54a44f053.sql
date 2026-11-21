ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS printer_width text DEFAULT '58mm',
  ADD COLUMN IF NOT EXISTS printer_font_size integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS printer_show_logo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS printer_show_address boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS printer_show_phone boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS printer_show_seller boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS printer_show_customer boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS printer_show_order_number boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS printer_show_payment_method boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS printer_show_date boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS printer_header_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS printer_footer_text text DEFAULT 'Obrigado pela preferência!';