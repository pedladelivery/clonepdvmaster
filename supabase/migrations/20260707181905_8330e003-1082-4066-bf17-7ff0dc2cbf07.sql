ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{"sales":true,"pending_sales":true}'::jsonb;

UPDATE public.profiles
SET permissions = '{"sales":true,"pending_sales":true}'::jsonb
WHERE permissions IS NULL OR permissions = '{}'::jsonb;