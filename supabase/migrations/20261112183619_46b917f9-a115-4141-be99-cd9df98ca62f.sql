DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.log_pdv_control_change()',
    'public.pdv_is_blocked(text)',
    'public.pdv_raise_blocked(text)',
    'public.pdv_lock_applies()',
    'public.enforce_pdv_sales_locks()',
    'public.enforce_pdv_sale_items_locks()',
    'public.enforce_pdv_returns_lock()',
    'public.enforce_pdv_admin_lock()',
    'public.enforce_pdv_profiles_admin_lock()']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;