-- Drop the insecure policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate with a WITH CHECK that prevents users from changing their own role
CREATE POLICY "Users can update their own profile (no role change)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role IS NOT DISTINCT FROM (
    SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);