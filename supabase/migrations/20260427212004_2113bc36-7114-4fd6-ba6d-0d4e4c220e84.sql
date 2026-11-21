-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow all store settings operations for demo" ON public.store_settings;

-- Authenticated users can read store settings (needed for app to display store info)
CREATE POLICY "Authenticated users can view store settings"
ON public.store_settings
FOR SELECT
TO authenticated
USING (true);

-- Only admins can insert store settings
CREATE POLICY "Admins can insert store settings"
ON public.store_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- Only admins can update store settings
CREATE POLICY "Admins can update store settings"
ON public.store_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- Only admins can delete store settings
CREATE POLICY "Admins can delete store settings"
ON public.store_settings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
  )
);