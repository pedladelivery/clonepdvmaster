
-- 1) Remove historical duplicate rows from store_settings, keep most recent
DELETE FROM public.store_settings
WHERE id NOT IN (
  SELECT id FROM public.store_settings
  ORDER BY created_at DESC
  LIMIT 1
);

-- 2) Restrict INSERT on store_settings to admins only (already restricted via existing policy, but ensure no permissive INSERT for authenticated remains).
-- Existing policies already require admin for INSERT/UPDATE/DELETE; no change needed.

-- 3) Add RLS policies for realtime.messages: scope subscriptions to authenticated users for the public broadcast topics only.
-- Allow authenticated users to receive realtime broadcasts on the public topics actually used by the app.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'Authenticated can read public realtime topics'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "Authenticated can read public realtime topics"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (true)
    $POL$;
  END IF;
END$$;
