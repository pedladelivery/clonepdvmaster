ALTER TABLE public.master_integration
  ADD COLUMN IF NOT EXISTS log_retention_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS cleanup_last_at timestamptz;

CREATE OR REPLACE FUNCTION public.master_save_sync_settings(_minutes integer, _retention_days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _job bigint;
  _expr text;
BEGIN
  IF _minutes NOT IN (1, 2, 5, 10, 15, 30, 60) THEN
    RAISE EXCEPTION 'Intervalo inválido: %', _minutes;
  END IF;
  IF _retention_days NOT IN (3, 7, 15, 30) THEN
    RAISE EXCEPTION 'Retenção inválida: %', _retention_days;
  END IF;
  _expr := CASE WHEN _minutes = 1 THEN '* * * * *'
                WHEN _minutes = 60 THEN '0 * * * *'
                ELSE '*/' || _minutes || ' * * * *' END;
  SELECT jobid INTO _job FROM cron.job WHERE jobname = 'pdv-master-sync' LIMIT 1;
  IF _job IS NOT NULL THEN
    PERFORM cron.alter_job(_job, schedule := _expr);
  END IF;
  UPDATE public.master_integration
     SET sync_interval_seconds = _minutes * 60,
         log_retention_days = _retention_days
   WHERE id = 1;
  RETURN jsonb_build_object('schedule', _expr, 'job_found', _job IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.master_cleanup_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _days integer;
  _cron integer := 0;
  _events integer := 0;
BEGIN
  SELECT COALESCE(log_retention_days, 7) INTO _days FROM public.master_integration WHERE id = 1;
  _days := COALESCE(_days, 7);
  DELETE FROM cron.job_run_details WHERE end_time < now() - make_interval(days => _days);
  GET DIAGNOSTICS _cron = ROW_COUNT;
  DELETE FROM public.master_events WHERE kind = 'heartbeat' AND created_at < now() - make_interval(days => _days);
  GET DIAGNOSTICS _events = ROW_COUNT;
  UPDATE public.master_integration SET cleanup_last_at = now() WHERE id = 1;
  RETURN jsonb_build_object('cron_runs_deleted', _cron, 'heartbeats_deleted', _events, 'retention_days', _days);
END;
$$;

REVOKE ALL ON FUNCTION public.master_save_sync_settings(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.master_cleanup_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.master_save_sync_settings(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.master_cleanup_logs() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'pdv-master-cleanup';
  PERFORM cron.schedule('pdv-master-cleanup', '0 6 * * *', 'SELECT public.master_cleanup_logs();');
END $$;