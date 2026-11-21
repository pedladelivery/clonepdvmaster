-- Trigger-only functions: nobody needs to call them directly
REVOKE EXECUTE ON FUNCTION public.assign_sale_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Sale number counter: assigned automatically by trigger; visitors must not bump it
REVOKE EXECUTE ON FUNCTION public.get_next_sale_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_next_sale_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_sale_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_sale_number(uuid) TO authenticated, service_role;

-- Access-check helpers: used only by signed-in policies
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_store(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_catalog(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_store_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_store(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_catalog(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_store_id(uuid) TO authenticated, service_role;

-- Master tables stay server-only
REVOKE ALL ON public.master_users, public.master_sessions, public.master_integration, public.master_commands, public.master_events FROM anon, authenticated;