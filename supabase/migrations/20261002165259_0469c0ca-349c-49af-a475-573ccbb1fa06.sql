CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can view payment methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage payment methods" ON public.payment_methods FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.payment_methods (code, name, kind, display_order) VALUES
('dinheiro','Dinheiro','cash',1),('cartao-credito','Cartão de Crédito','card',2),('cartao-debito','Cartão de Débito','card',3),('pix','PIX','pix',4);

CREATE TABLE public.pix_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pix_key text,
  receiver_name text,
  receiver_city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pix_settings TO authenticated;
GRANT ALL ON public.pix_settings TO service_role;
ALTER TABLE public.pix_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can view pix settings" ON public.pix_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage pix settings" ON public.pix_settings FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER update_pix_settings_updated_at BEFORE UPDATE ON public.pix_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();