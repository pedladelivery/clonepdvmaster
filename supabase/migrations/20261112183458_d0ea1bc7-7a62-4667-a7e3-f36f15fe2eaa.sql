-- ===== Master area tables =====
CREATE TABLE public.master_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.master_users TO service_role;
ALTER TABLE public.master_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.master_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id uuid NOT NULL REFERENCES public.master_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.master_sessions TO service_role;
ALTER TABLE public.master_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.master_integration (
  id integer PRIMARY KEY DEFAULT 1,
  base_url text,
  installation_id text,
  token_encrypted text,
  token_last4 text,
  store_name text,
  status text NOT NULL DEFAULT 'disconnected',
  license_status text,
  last_verify_at timestamptz,
  last_heartbeat_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_integration_single_row CHECK (id = 1)
);
GRANT ALL ON public.master_integration TO service_role;
ALTER TABLE public.master_integration ENABLE ROW LEVEL SECURITY;
INSERT INTO public.master_integration (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.master_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id text NOT NULL UNIQUE,
  installation_id text,
  command_type text NOT NULL,
  payload jsonb,
  status text NOT NULL DEFAULT 'received',
  master_created_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.master_commands TO service_role;
ALTER TABLE public.master_commands ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.master_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  message text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.master_events TO service_role;
ALTER TABLE public.master_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX master_events_created_at_idx ON public.master_events (created_at DESC);

CREATE TABLE public.pdv_controls (
  key text PRIMARY KEY,
  blocked boolean NOT NULL DEFAULT false,
  message text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text,
  source text NOT NULL DEFAULT 'local',
  CONSTRAINT pdv_controls_key_check CHECK (key IN ('admin','tables','sales'))
);
GRANT SELECT ON public.pdv_controls TO authenticated;
GRANT ALL ON public.pdv_controls TO service_role;
ALTER TABLE public.pdv_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view PDV controls" ON public.pdv_controls
  FOR SELECT TO authenticated USING (true);
INSERT INTO public.pdv_controls (key) VALUES ('admin'),('tables'),('sales') ON CONFLICT DO NOTHING;

CREATE TRIGGER update_master_users_updated_at BEFORE UPDATE ON public.master_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_master_integration_updated_at BEFORE UPDATE ON public.master_integration
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_master_commands_updated_at BEFORE UPDATE ON public.master_commands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log every control change
CREATE OR REPLACE FUNCTION public.log_pdv_control_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.blocked IS DISTINCT FROM OLD.blocked OR NEW.message IS DISTINCT FROM OLD.message THEN
    INSERT INTO public.master_events (kind, message, details)
    VALUES ('control_change',
      'Controle ' || NEW.key || ' ' || CASE WHEN NEW.blocked THEN 'bloqueado' ELSE 'liberado' END,
      jsonb_build_object('key', NEW.key, 'blocked', NEW.blocked, 'previous_blocked', OLD.blocked,
        'message', NEW.message, 'changed_by', NEW.changed_by, 'source', NEW.source));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER pdv_controls_log AFTER UPDATE ON public.pdv_controls
  FOR EACH ROW EXECUTE FUNCTION public.log_pdv_control_change();

ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_controls;

-- ===== Lock helpers =====
CREATE OR REPLACE FUNCTION public.pdv_is_blocked(_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT blocked FROM public.pdv_controls WHERE key = _key), false)
$$;

-- Locks apply to app/API callers (anon, authenticated). Server-side code (service_role)
-- checks the locks itself; internal auth triggers have no API role.
CREATE OR REPLACE FUNCTION public.pdv_lock_applies()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') IN ('anon', 'authenticated')
$$;

CREATE OR REPLACE FUNCTION public.pdv_raise_blocked(_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _msg text;
BEGIN
  SELECT message INTO _msg FROM public.pdv_controls WHERE key = _key;
  RAISE EXCEPTION 'PDV_BLOCKED:%:%', _key, COALESCE(_msg, '') USING ERRCODE = 'P0001';
END; $$;

-- ===== Sales / tables lock =====
CREATE OR REPLACE FUNCTION public.enforce_pdv_sales_locks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pdv_lock_applies() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF public.pdv_is_blocked('tables') THEN PERFORM public.pdv_raise_blocked('tables'); END IF;
    IF COALESCE(NEW.status, 'completed') <> 'pending' AND public.pdv_is_blocked('sales') THEN
      PERFORM public.pdv_raise_blocked('sales');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF public.pdv_is_blocked('sales') AND (
      COALESCE(OLD.status, 'completed') <> 'pending'
      OR COALESCE(NEW.status, 'completed') <> 'pending'
    ) THEN
      PERFORM public.pdv_raise_blocked('sales');
    END IF;
    RETURN NEW;
  ELSE
    IF public.pdv_is_blocked('sales') AND COALESCE(OLD.status, 'completed') <> 'pending' THEN
      PERFORM public.pdv_raise_blocked('sales');
    END IF;
    RETURN OLD;
  END IF;
END; $$;
CREATE TRIGGER pdv_sales_locks BEFORE INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pdv_sales_locks();

CREATE OR REPLACE FUNCTION public.enforce_pdv_sale_items_locks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sale_id uuid; _status text;
BEGIN
  IF public.pdv_lock_applies() AND public.pdv_is_blocked('sales') THEN
    _sale_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.sale_id ELSE NEW.sale_id END;
    SELECT status INTO _status FROM public.sales WHERE id = _sale_id;
    IF COALESCE(_status, 'completed') <> 'pending' THEN
      PERFORM public.pdv_raise_blocked('sales');
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER pdv_sale_items_locks BEFORE INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pdv_sale_items_locks();

CREATE OR REPLACE FUNCTION public.enforce_pdv_returns_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.pdv_lock_applies() AND public.pdv_is_blocked('sales') THEN
    PERFORM public.pdv_raise_blocked('sales');
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER pdv_returns_lock BEFORE INSERT OR UPDATE OR DELETE ON public.returns
  FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_pdv_returns_lock();

-- ===== Admin lock =====
CREATE OR REPLACE FUNCTION public.enforce_pdv_admin_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.pdv_lock_applies() AND public.pdv_is_blocked('admin') THEN
    PERFORM public.pdv_raise_blocked('admin');
  END IF;
  RETURN NULL;
END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','complement_groups','complement_items',
    'product_complement_groups','store_settings','payment_methods','pix_settings','sellers',
    'seller_stores','suppliers','stores','store_categories','store_products','store_stock',
    'user_categories','user_stores']
  LOOP
    EXECUTE format('CREATE TRIGGER pdv_admin_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_pdv_admin_lock()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_pdv_profiles_admin_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.pdv_lock_applies() AND public.pdv_is_blocked('admin') THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.pdv_raise_blocked('admin');
    ELSIF TG_OP = 'INSERT'
      OR NEW.role IS DISTINCT FROM OLD.role
      OR NEW.permissions IS DISTINCT FROM OLD.permissions
      OR NEW.store_id IS DISTINCT FROM OLD.store_id THEN
      PERFORM public.pdv_raise_blocked('admin');
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER pdv_profiles_admin_lock BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pdv_profiles_admin_lock();