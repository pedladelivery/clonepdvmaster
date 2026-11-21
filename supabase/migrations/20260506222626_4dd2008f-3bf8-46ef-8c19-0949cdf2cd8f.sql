
-- 1) Scope realtime.messages SELECT policy to specific topics
DROP POLICY IF EXISTS "Authenticated can read public realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can read public realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('products', 'categories', 'store_settings')
);

-- 2) Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated
-- These are invoked via triggers/policies (which run as definer), not directly by clients.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_next_sale_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_sale_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
