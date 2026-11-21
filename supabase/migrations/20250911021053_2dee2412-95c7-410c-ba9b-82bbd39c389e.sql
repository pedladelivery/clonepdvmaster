-- Add visual customization fields to store_settings table
ALTER TABLE public.store_settings 
ADD COLUMN logo_url TEXT,
ADD COLUMN primary_color TEXT DEFAULT '#6366f1',
ADD COLUMN secondary_color TEXT DEFAULT '#8b5cf6', 
ADD COLUMN accent_color TEXT DEFAULT '#06b6d4',
ADD COLUMN background_color TEXT DEFAULT '#ffffff';

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Create policies for logo uploads
CREATE POLICY "Anyone can view logos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'logos');

CREATE POLICY "Users can upload logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Users can update logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'logos');

CREATE POLICY "Users can delete logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'logos');