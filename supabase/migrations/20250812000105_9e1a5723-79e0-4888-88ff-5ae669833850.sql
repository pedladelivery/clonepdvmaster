-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'operator',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category_id TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on products (public read access)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" 
ON public.products 
FOR SELECT 
USING (active = true);

-- Create categories table
CREATE TABLE public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on categories (public read access)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories" 
ON public.categories 
FOR SELECT 
USING (active = true);

-- Create sales table
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  customer_name TEXT,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sales" 
ON public.sales 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create sales" 
ON public.sales 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create sale_items table
CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sale_items
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items from their own sales" 
ON public.sale_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.sales 
    WHERE sales.id = sale_items.sale_id 
    AND sales.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create sale items for their own sales" 
ON public.sale_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales 
    WHERE sales.id = sale_items.sale_id 
    AND sales.user_id = auth.uid()
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuário')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert initial categories
INSERT INTO public.categories (id, name, image_url) VALUES
('lanches', 'Lanches', '/src/assets/category-lanches.jpg'),
('bebidas', 'Bebidas', '/src/assets/category-bebidas.jpg'),
('almoco', 'Almoço', '/src/assets/category-almoco.jpg'),
('sobremesas', 'Sobremesas', '/src/assets/category-sobremesas.jpg');

-- Insert sample products
INSERT INTO public.products (name, description, price, category_id, image_url) VALUES
('Hambúrguer Artesanal', 'Hambúrguer com carne bovina, queijo, alface e tomate', 25.90, 'lanches', '/src/assets/category-lanches.jpg'),
('X-Bacon', 'Hambúrguer com bacon crocante e queijo cheddar', 28.50, 'lanches', '/src/assets/category-lanches.jpg'),
('Coca-Cola 350ml', 'Refrigerante Coca-Cola lata 350ml gelada', 5.50, 'bebidas', '/src/assets/category-bebidas.jpg'),
('Suco Natural Laranja', 'Suco de laranja natural 300ml', 8.90, 'bebidas', '/src/assets/category-bebidas.jpg'),
('Prato Executivo', 'Arroz, feijão, carne grelhada, salada e batata frita', 22.90, 'almoco', '/src/assets/category-almoco.jpg'),
('Feijoada Completa', 'Feijoada tradicional com acompanhamentos', 32.90, 'almoco', '/src/assets/category-almoco.jpg'),
('Pudim de Leite', 'Pudim caseiro com calda de caramelo', 12.90, 'sobremesas', '/src/assets/category-sobremesas.jpg'),
('Brigadeiro Gourmet', 'Brigadeiro artesanal - 6 unidades', 15.90, 'sobremesas', '/src/assets/category-sobremesas.jpg');