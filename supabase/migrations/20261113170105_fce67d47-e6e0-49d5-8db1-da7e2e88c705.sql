ALTER TABLE public.master_integration
  ADD COLUMN IF NOT EXISTS sync_interval_seconds integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS sync_lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_commands_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_report_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS financial_unpublished_until timestamptz;

ALTER TABLE public.master_commands
  ADD COLUMN IF NOT EXISTS acked_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

-- Atomic sync lock so automatic and manual syncs never process the same command twice
CREATE OR REPLACE FUNCTION public.master_try_sync_lock(_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ok boolean;
BEGIN
  UPDATE public.master_integration SET sync_lock_until = now() + make_interval(secs => _seconds)
  WHERE id = 1 AND (sync_lock_until IS NULL OR sync_lock_until < now())
  RETURNING true INTO _ok;
  RETURN COALESCE(_ok, false);
END; $$;
REVOKE EXECUTE ON FUNCTION public.master_try_sync_lock(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.master_try_sync_lock(integer) TO service_role;

CREATE INDEX IF NOT EXISTS master_commands_status_idx ON public.master_commands (status);