-- Add seller_id column to sales table
ALTER TABLE public.sales 
ADD COLUMN seller_id UUID REFERENCES public.sellers(id);