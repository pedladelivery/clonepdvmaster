-- 1. Backfill existing NULL sale_numbers using the existing sequence
DO $$
DECLARE
  r RECORD;
  next_num INTEGER;
  max_existing INTEGER;
  seq_current INTEGER;
BEGIN
  SELECT COALESCE(MAX(sale_number), 0) INTO max_existing FROM public.sales;
  SELECT last_number INTO seq_current FROM public.sale_number_sequence WHERE id = 1;

  IF seq_current < max_existing THEN
    UPDATE public.sale_number_sequence SET last_number = max_existing, updated_at = now() WHERE id = 1;
  END IF;

  FOR r IN
    SELECT id FROM public.sales WHERE sale_number IS NULL ORDER BY created_at ASC
  LOOP
    next_num := public.get_next_sale_number();
    UPDATE public.sales SET sale_number = next_num WHERE id = r.id;
  END LOOP;
END $$;

-- 2. Create trigger so every new sale gets a sequential number
DROP TRIGGER IF EXISTS trg_assign_sale_number ON public.sales;
CREATE TRIGGER trg_assign_sale_number
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.assign_sale_number();