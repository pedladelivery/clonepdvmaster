-- Criar tabela de controle de numeração sequencial
CREATE TABLE IF NOT EXISTS public.sale_number_sequence (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Inserir registro inicial
INSERT INTO public.sale_number_sequence (id, last_number)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.sale_number_sequence ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura e escrita
CREATE POLICY "Allow all operations on sale number sequence"
ON public.sale_number_sequence
FOR ALL
USING (true)
WITH CHECK (true);

-- Adicionar coluna sale_number à tabela sales
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS sale_number INTEGER;

-- Função para obter o próximo número sequencial
CREATE OR REPLACE FUNCTION public.get_next_sale_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Atualizar e retornar o próximo número
  UPDATE sale_number_sequence
  SET last_number = last_number + 1,
      updated_at = now()
  WHERE id = 1
  RETURNING last_number INTO next_num;
  
  RETURN next_num;
END;
$$;

-- Trigger para atribuir automaticamente o número sequencial
CREATE OR REPLACE FUNCTION public.assign_sale_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só atribui se ainda não tiver número
  IF NEW.sale_number IS NULL THEN
    NEW.sale_number := get_next_sale_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Criar o trigger
DROP TRIGGER IF EXISTS set_sale_number ON public.sales;
CREATE TRIGGER set_sale_number
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION assign_sale_number();