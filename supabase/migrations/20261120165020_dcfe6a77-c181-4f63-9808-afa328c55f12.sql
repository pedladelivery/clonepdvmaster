-- ===== License suspension lock (Painel Master is the only authority) =====
-- Source of truth stays master_integration.license_status (written by the Master sync).
-- pdv_license_state is a read-only mirror the app reads and listens to in realtime.
CREATE TABLE IF NOT EXISTS public.pdv_license_state (
  id integer PRIMARY KEY DEFAULT 1,
  license_status text,
  suspended boolean NOT NULL DEFAULT false,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdv_license_state_single_row CHECK (id = 1)
);
GRANT SELECT ON public.pdv_license_state TO authenticated;
GRANT ALL ON public.pdv_license_state TO service_role;
ALTER TABLE public.pdv_license_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view license state" ON public.pdv_license_state
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.pdv_license_state (id, license_status, suspended)
SELECT 1, license_status, COALESCE(license_status = 'suspended', false) FROM public.master_integration WHERE id = 1
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pdv_license_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_license_state;

CREATE OR REPLACE FUNCTION public.pdv_license_suspended()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT license_status = 'suspended' FROM public.master_integration WHERE id = 1), false)
$$;

-- Mirror license changes and log them.
CREATE OR REPLACE FUNCTION public.mirror_pdv_license_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.license_status IS DISTINCT FROM OLD.license_status THEN
    INSERT INTO public.pdv_license_state (id, license_status, suspended, changed_at)
    VALUES (1, NEW.license_status, COALESCE(NEW.license_status = 'suspended', false), now())
    ON CONFLICT (id) DO UPDATE
      SET license_status = EXCLUDED.license_status, suspended = EXCLUDED.suspended, changed_at = EXCLUDED.changed_at;
    INSERT INTO public.master_events (kind, message, details)
    VALUES ('license_change',
      CASE WHEN NEW.license_status = 'suspended' THEN 'Licença suspensa pelo Painel Master'
           WHEN NEW.license_status = 'active' THEN 'Licença reativada pelo Painel Master'
           ELSE 'Situação da licença alterada' END,
      jsonb_build_object('license_status', NEW.license_status,
        'previous_license_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.license_status END));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER master_integration_license_mirror AFTER INSERT OR UPDATE OF license_status ON public.master_integration
  FOR EACH ROW EXECUTE FUNCTION public.mirror_pdv_license_state();

-- Refuse every operational write from app/API callers while suspended.
-- ERRCODE 42501 makes the API answer HTTP 403; DETAIL carries a structured reply.
CREATE OR REPLACE FUNCTION public.enforce_pdv_license_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.pdv_lock_applies() AND public.pdv_license_suspended() THEN
    RAISE EXCEPTION 'PDV_LICENSE_SUSPENDED: Este estabelecimento está temporariamente suspenso.'
      USING ERRCODE = '42501',
        DETAIL = '{"error":"license_suspended","license_status":"suspended","subscription_available":true}',
        HINT = 'Consulte Minha Assinatura para verificar a situação e as opções disponíveis.';
  END IF;
  RETURN NULL;
END; $$;

-- Named pdv_0_* so it fires before the other PDV locks and its message prevails.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'master\_%'
      AND tablename NOT IN ('pdv_controls', 'pdv_license_state')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS pdv_0_license_lock ON public.%I', t);
    EXECUTE format('CREATE TRIGGER pdv_0_license_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_pdv_license_lock()', t);
  END LOOP;
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.pdv_license_suspended()',
    'public.mirror_pdv_license_state()',
    'public.enforce_pdv_license_lock()']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;