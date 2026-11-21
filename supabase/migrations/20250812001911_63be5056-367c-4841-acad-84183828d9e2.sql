-- Add ordering fields to categories and products tables
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create admin policies for categories
CREATE POLICY "Admins can manage categories" 
ON categories 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Create admin policies for products  
CREATE POLICY "Admins can manage products"
ON products
FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Update existing categories with display order
UPDATE categories SET display_order = 
  CASE 
    WHEN id = 'lanches' THEN 1
    WHEN id = 'almoco' THEN 2  
    WHEN id = 'bebidas' THEN 3
    WHEN id = 'sobremesas' THEN 4
    ELSE 5
  END;

-- Update existing products with display order (ordered by name within each category)
WITH ordered_products AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY name) as row_num
  FROM products
)
UPDATE products 
SET display_order = ordered_products.row_num
FROM ordered_products 
WHERE products.id = ordered_products.id;