
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_sale_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_next_sale_number(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_store_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_store(uuid, uuid) FROM anon;
