-- Allow authenticated users to read all profiles (needed for admin management)
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop the restrictive policy that only allows viewing own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;