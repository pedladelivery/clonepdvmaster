
-- 1) Revoke anon access from sensitive tables (still accessible to authenticated via RLS)
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.sales FROM anon;
REVOKE ALL ON TABLE public.sale_items FROM anon;
REVOKE ALL ON TABLE public.customers FROM anon;
REVOKE ALL ON TABLE public.sellers FROM anon;
REVOKE ALL ON TABLE public.suppliers FROM anon;
REVOKE ALL ON TABLE public.transactions FROM anon;
REVOKE ALL ON TABLE public.stock_movements FROM anon;
REVOKE ALL ON TABLE public.returns FROM anon;
REVOKE ALL ON TABLE public.sale_number_sequence FROM anon;

-- 2) Lock sale_number_sequence: deny direct writes from authenticated users (only SECURITY DEFINER fn can mutate)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.sale_number_sequence FROM authenticated;

-- 3) Revoke EXECUTE from anon on SECURITY DEFINER functions (keep authenticated where needed)
REVOKE EXECUTE ON FUNCTION public.get_next_sale_number() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_next_sale_number() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- handle_new_user, assign_sale_number, update_updated_at_column are trigger functions; revoke broad EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_sale_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
