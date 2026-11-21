DROP POLICY IF EXISTS "Allow all returns operations for demo" ON public.returns;

CREATE POLICY "Authenticated users can view returns"
ON public.returns
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert returns"
ON public.returns
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update returns"
ON public.returns
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete returns"
ON public.returns
FOR DELETE
TO authenticated
USING (true);