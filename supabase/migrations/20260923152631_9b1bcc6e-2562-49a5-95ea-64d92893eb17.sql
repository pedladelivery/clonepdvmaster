
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_store_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_store(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_store_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_store(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_next_sale_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_next_sale_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_sale_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_sale_number(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_sale_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
