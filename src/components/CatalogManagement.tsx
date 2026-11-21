import { StorageImage } from "@/components/ui/StorageImage";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Tag,
  Save,
  X,
  Search,
  Layers,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BackToMainButton } from "@/components/ui/BackToMainButton";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ComplementsTab } from "@/components/ComplementsTab";

interface Category {
  id: string;
  name: string;
  image_url?: string;
  active: boolean;
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  image_url?: string;
  active: boolean;
  display_order: number;
}

interface CatalogManagementProps {
  onBackToMain: () => void;
}

export const CatalogManagement = ({ onBackToMain }: CatalogManagementProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryGroup = (key: string) => {
    setOpenCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Form states
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    image_url: ""
  });

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: 0,
    category_id: "",
    image_url: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      
      const [categoriesResponse, productsResponse] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*')
      ]);

      if (categoriesResponse.error) throw categoriesResponse.error;
      if (productsResponse.error) throw productsResponse.error;

      // Sort categories and products alphabetically
      const sortedCategories = (categoriesResponse.data || []).sort((a, b) => 
        a.name.localeCompare(b.name, 'pt-BR')
      );
      const sortedProducts = (productsResponse.data || []).sort((a, b) => 
        a.name.localeCompare(b.name, 'pt-BR')
      );

      setCategories(sortedCategories);
      setProducts(sortedProducts);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Category functions
  const handleSaveCategory = async () => {
    try {
      if (!categoryForm.name.trim()) {
        toast({
          title: "Erro",
          description: "Nome da categoria é obrigatório",
          variant: "destructive"
        });
        return;
      }

      const categoryData = {
        ...categoryForm,
        active: true
      };

      if (editingCategory) {
        const { data: updated, error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', editingCategory.id)
          .select()
          .maybeSingle();
        
        if (error) throw error;
        if (!updated) {
          throw new Error('Nenhuma categoria foi atualizada.');
        }
        
        toast({
          title: "Sucesso",
          description: "Categoria atualizada com sucesso"
        });
      } else {
        const baseId = categoryForm.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'categoria';
        const uniqueId = `${baseId}-${Date.now().toString(36)}`;
        const { error } = await supabase
          .from('categories')
          .insert([{ ...categoryData, id: uniqueId }]);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Categoria criada com sucesso"
        });
      }

      setCategoryDialog(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", image_url: "" });
      fetchData();
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar categoria",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      // Check if category has products
      const { data: categoryProducts } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', categoryId);

      if (categoryProducts && categoryProducts.length > 0) {
        toast({
          title: "Erro",
          description: `Esta categoria ainda tem ${categoryProducts.length} produto(s) (incluindo desativados). Mova-os para outra categoria antes de excluir.`,
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso"
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir categoria",
        variant: "destructive"
      });
    }
  };

  // Product functions
  const handleSaveProduct = async () => {
    try {
      if (!productForm.name.trim() || !productForm.category_id || productForm.price <= 0) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios",
          variant: "destructive"
        });
        return;
      }

      const productData = {
        ...productForm,
        active: true
      };

      if (editingProduct) {
        const { data: updated, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
          .select()
          .maybeSingle();
        
        if (error) throw error;
        if (!updated) {
          throw new Error('Nenhum produto foi atualizado.');
        }
        
        toast({
          title: "Sucesso",
          description: "Produto atualizado com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Produto criado com sucesso"
        });
      }

      setProductDialog(false);
      setEditingProduct(null);
      setProductForm({
        name: "",
        description: "",
        price: 0,
        category_id: "",
        image_url: ""
      });
      fetchData();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar produto",
        variant: "destructive"
      });
    }
  };

  const toggleCategoryActive = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ active: !category.active })
        .eq('id', category.id);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: `Categoria ${!category.active ? 'ativada' : 'desativada'}`
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling category:', error);
      toast({ title: "Erro", description: "Falha ao atualizar status", variant: "destructive" });
    }
  };

  const toggleProductActive = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ active: !product.active })
        .eq('id', product.id);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: `Produto ${!product.active ? 'ativado' : 'desativado'}`
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling product:', error);
      toast({ title: "Erro", description: "Falha ao atualizar status", variant: "destructive" });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error && (error as any).code === '23503') {
        // Produto já usado em vendas: não pode ser apagado sem perder o histórico → desativa
        const { error: upErr } = await supabase.from('products').update({ active: false }).eq('id', productId);
        if (upErr) throw upErr;
        toast({
          title: "Produto desativado",
          description: "Este produto já tem vendas registradas, então foi desativado (some do PDV) para preservar o histórico."
        });
        fetchData();
        return;
      }
      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Produto excluído com sucesso"
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir produto",
        variant: "destructive"
      });
    }
  };

  const openCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        image_url: category.image_url || ""
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: "", image_url: "" });
    }
    setCategoryDialog(true);
  };

  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || "",
        price: product.price,
        category_id: product.category_id,
        image_url: product.image_url || ""
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        name: "",
        description: "",
        price: 0,
        category_id: "",
        image_url: ""
      });
    }
    setProductDialog(true);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="text-lg">Carregando catálogo...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BackToMainButton onBackToMain={onBackToMain} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Gerenciar Catálogo</h1>
        <p className="text-muted-foreground">
          Adicione, edite ou remova categorias e produtos do seu cardápio
        </p>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="complements" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Complementos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="complements" className="space-y-4">
          <ComplementsTab products={products} />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Categorias</h2>
            <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => openCategoryDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Categoria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="category-name">Nome da Categoria *</Label>
                    <Input
                      id="category-name"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="Ex: Lanches, Bebidas, Sobremesas"
                    />
                  </div>
                  <div>
                    <ImageUpload
                      value={categoryForm.image_url}
                      onChange={(url) => setCategoryForm({ ...categoryForm, image_url: url || "" })}
                      label="Imagem da Categoria"
                      folder="categories"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveCategory} className="flex-1">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCategoryDialog(false)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Pesquisar categoria por nome..."
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories
              .filter((c) => c.name.toLowerCase().includes(categorySearch.trim().toLowerCase()))
              .map((category) => (
              <Card key={category.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCategoryDialog(category)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
            {category.image_url ? (
              <div className="w-32 h-24 overflow-hidden rounded-md bg-muted">
                <StorageImage
                  src={category.image_url}
                  alt={`Imagem da categoria ${category.name}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem imagem</div>
            )}
                    <div className="flex justify-between items-center">
                      <Badge variant={category.active ? "default" : "secondary"}>
                        {category.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`cat-active-${category.id}`} className="text-xs text-muted-foreground">
                          {category.active ? "Ativo" : "Inativo"}
                        </Label>
                        <Switch
                          id={`cat-active-${category.id}`}
                          checked={category.active}
                          onCheckedChange={() => toggleCategoryActive(category)}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {products.filter(p => p.category_id === category.id).length} produtos
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Produtos</h2>
            <Dialog open={productDialog} onOpenChange={setProductDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => openProductDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Editar Produto" : "Novo Produto"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="product-name">Nome do Produto *</Label>
                      <Input
                        id="product-name"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="Ex: Hambúrguer Artesanal"
                      />
                    </div>
                    <div>
                      <Label htmlFor="product-category">Categoria *</Label>
                      <Select
                        value={productForm.category_id}
                        onValueChange={(value) => setProductForm({ ...productForm, category_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="product-description">Descrição</Label>
                    <Textarea
                      id="product-description"
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      placeholder="Descreva o produto..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="product-price">Preço *</Label>
                    <Input
                      id="product-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <ImageUpload
                      value={productForm.image_url}
                      onChange={(url) => setProductForm({ ...productForm, image_url: url || "" })}
                      label="Imagem do Produto"
                      folder="products"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveProduct} className="flex-1">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setProductDialog(false)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Pesquisar produto por nome ou descrição..."
              className="pl-9"
            />
          </div>

          {(() => {
            const q = productSearch.trim().toLowerCase();
            const filteredProducts = products.filter((p) => {
              if (!q) return true;
              return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
            });

            const renderProductRow = (product: Product) => {
              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 border-b last:border-b-0 px-3 py-2"
                >
                  <div className="w-12 h-12 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                    {product.image_url ? (
                      <StorageImage
                        src={product.image_url}
                        alt={`Imagem do produto ${product.name}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold uppercase truncate">{product.name}</div>
                    <div className="text-sm font-bold text-primary">
                      R$ {product.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={product.active ? "default" : "secondary"}>
                      {product.active ? "Disponível" : "Inativo"}
                    </Badge>
                    <Switch
                      id={`prod-active-${product.id}`}
                      checked={product.active}
                      onCheckedChange={() => toggleProductActive(product)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openProductDialog(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            };

            const groups = [
              ...categories.map((c) => ({ key: c.id, name: c.name, items: filteredProducts.filter(p => p.category_id === c.id) })),
              { key: "__sem_categoria__", name: "Sem categoria", items: filteredProducts.filter(p => !categories.some(c => c.id === p.category_id)) },
            ].filter((g) => g.items.length > 0);

            if (groups.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum produto encontrado.
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {groups.map((group) => {
                  const isOpen = q ? true : !!openCategories[group.key];
                  return (
                    <Collapsible
                      key={group.key}
                      open={isOpen}
                      onOpenChange={() => toggleCategoryGroup(group.key)}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-md border bg-card px-4 py-3 text-left hover:bg-accent/50 transition-colors"
                        >
                          <span className="flex items-center gap-2 font-semibold">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {group.name}
                          </span>
                          <Badge variant="secondary">{group.items.length} produto(s)</Badge>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="rounded-md border bg-card mt-1 divide-y-0">
                          {group.items.map(renderProductRow)}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
};