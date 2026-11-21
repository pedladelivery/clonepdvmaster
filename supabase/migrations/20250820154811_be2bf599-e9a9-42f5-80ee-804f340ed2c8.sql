-- Remove foreign key constraint that's blocking demo sales
-- First check if the constraint exists and drop it
DO $$ 
BEGIN
    -- Drop the foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'sales_user_id_fkey' 
        AND table_name = 'sales'
    ) THEN
        ALTER TABLE sales DROP CONSTRAINT sales_user_id_fkey;
    END IF;
END $$;

-- Also create a demo user profile if it doesn't exist
INSERT INTO profiles (id, user_id, full_name, role) 
VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'Demo User',
    'operator'
) 
ON CONFLICT (user_id) DO NOTHING;