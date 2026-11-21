
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_sale_number() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_sale_number(uuid) TO authenticated, service_role;
