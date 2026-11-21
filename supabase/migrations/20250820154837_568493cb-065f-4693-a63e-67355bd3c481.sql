-- Remove foreign key constraints and allow demo operations
-- Drop constraints that require valid user_ids in auth.users table

-- Drop profile constraint if exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_user_id_fkey' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_user_id_fkey;
    END IF;
END $$;

-- Update RLS policies to allow operations without authentication for demo
DROP POLICY IF EXISTS "Allow demo sales creation" ON sales;
DROP POLICY IF EXISTS "Allow demo sales viewing" ON sales;
DROP POLICY IF EXISTS "Allow demo sale items creation" ON sale_items;
DROP POLICY IF EXISTS "Allow demo sale items viewing" ON sale_items;

-- Create simple policies that work for demo
CREATE POLICY "Allow all sales operations for demo" 
ON sales 
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all sale items operations for demo" 
ON sale_items 
FOR ALL
USING (true)
WITH CHECK (true);