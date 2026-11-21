
-- Secure helper function to check admin role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- Drop both existing UPDATE policies that together create the escalation vector
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (no role change)" ON public.profiles;

-- Consolidated UPDATE policy:
-- - Admins (verified via SECURITY DEFINER function) can update any profile and any field
-- - Non-admins can only update their own profile and cannot change the role field
CREATE POLICY "Profile updates with role protection"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid()) OR auth.uid() = user_id
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    auth.uid() = user_id
    AND role IS NOT DISTINCT FROM (
      SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- Also tighten DELETE policy to use the same secure function (avoids self-referential check)
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
