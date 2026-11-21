-- Fix image URLs to use correct paths for web assets
UPDATE categories SET image_url = '/assets/category-lanches.jpg' WHERE id = 'lanches';
UPDATE categories SET image_url = '/assets/category-almoco.jpg' WHERE id = 'almoco';
UPDATE categories SET image_url = '/assets/category-bebidas.jpg' WHERE id = 'bebidas';
UPDATE categories SET image_url = '/assets/category-sobremesas.jpg' WHERE id = 'sobremesas';

-- Fix product image URLs too
UPDATE products SET image_url = '/assets/category-almoco.jpg' WHERE category_id = 'almoco';
UPDATE products SET image_url = '/assets/category-bebidas.jpg' WHERE category_id = 'bebidas';
UPDATE products SET image_url = '/assets/category-lanches.jpg' WHERE category_id = 'lanches';
UPDATE products SET image_url = '/assets/category-sobremesas.jpg' WHERE category_id = 'sobremesas';