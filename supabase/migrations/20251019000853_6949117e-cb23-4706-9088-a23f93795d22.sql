-- Ensure catalog-images bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-images', 'catalog-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public Access for catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete catalog images" ON storage.objects;

-- Create policy to allow public read access to catalog images
CREATE POLICY "Public Access for catalog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'catalog-images');

-- Create policy to allow authenticated users to upload catalog images
CREATE POLICY "Authenticated users can upload catalog images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'catalog-images' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to update catalog images
CREATE POLICY "Authenticated users can update catalog images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'catalog-images' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to delete catalog images
CREATE POLICY "Authenticated users can delete catalog images"
ON storage.objects FOR DELETE
USING (bucket_id = 'catalog-images' AND auth.role() = 'authenticated');