-- Allow demo operations without authentication by accepting the demo user ID
-- First, let's allow reading data for everyone (already exists but making sure)

-- Update sales policies to allow demo user
DROP POLICY IF EXISTS "Users can create sales" ON sales;
DROP POLICY IF EXISTS "Users can view their own sales" ON sales;

CREATE POLICY "Allow demo sales creation" 
ON sales 
FOR INSERT 
WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid OR auth.uid() = user_id);

CREATE POLICY "Allow demo sales viewing" 
ON sales 
FOR SELECT 
USING (user_id = '00000000-0000-0000-0000-000000000000'::uuid OR auth.uid() = user_id);

-- Update sale_items policies to allow demo user
DROP POLICY IF EXISTS "Users can create sale items for their own sales" ON sale_items;
DROP POLICY IF EXISTS "Users can view items from their own sales" ON sale_items;

CREATE POLICY "Allow demo sale items creation" 
ON sale_items 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND (sales.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR sales.user_id = auth.uid())));

CREATE POLICY "Allow demo sale items viewing" 
ON sale_items 
FOR SELECT 
USING (EXISTS ( SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND (sales.user_id = '00000000-0000-0000-0000-000000000000'::uuid OR sales.user_id = auth.uid())));