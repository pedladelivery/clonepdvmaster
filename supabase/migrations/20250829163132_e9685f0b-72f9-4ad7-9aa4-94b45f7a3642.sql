-- Adicionar campos de estoque na tabela products
ALTER TABLE public.products 
ADD COLUMN stock_quantity INTEGER DEFAULT 0,
ADD COLUMN min_stock INTEGER DEFAULT 0;

-- Criar tabela de movimentações de estoque
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de transações financeiras
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de devoluções
CREATE TABLE public.returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de configurações da loja
CREATE TABLE public.store_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  cnpj TEXT,
  opening_hours TEXT,
  notifications_enabled BOOLEAN DEFAULT true,
  auto_backup BOOLEAN DEFAULT true,
  low_stock_alert BOOLEAN DEFAULT true,
  min_stock_threshold INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Criar políticas para stock_movements
CREATE POLICY "Allow all stock movements operations for demo" 
ON public.stock_movements 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Criar políticas para transactions
CREATE POLICY "Allow all transactions operations for demo" 
ON public.transactions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Criar políticas para returns
CREATE POLICY "Allow all returns operations for demo" 
ON public.returns 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Criar políticas para store_settings
CREATE POLICY "Allow all store settings operations for demo" 
ON public.store_settings 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger para atualizar updated_at na tabela store_settings
CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();