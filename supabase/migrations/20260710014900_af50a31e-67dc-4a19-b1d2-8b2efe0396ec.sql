
-- Renumerar todas as vendas em ordem crescente por created_at, começando em 1
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.sales
)
UPDATE public.sales s
SET sale_number = o.rn
FROM ordered o
WHERE s.id = o.id;

-- Ajustar a sequência para o próximo número correto
UPDATE public.sale_number_sequence
SET last_number = COALESCE((SELECT MAX(sale_number) FROM public.sales), 0),
    updated_at = now()
WHERE id = 1;

-- Garantir que o trigger de atribuição automática está ativo
DROP TRIGGER IF EXISTS trg_assign_sale_number ON public.sales;
CREATE TRIGGER trg_assign_sale_number
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.assign_sale_number();
