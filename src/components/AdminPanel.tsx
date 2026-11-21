import { useState, useEffect } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, Plus, Edit2, GripVertical, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Category {
  id: string;
  name: string;
  display_order: number;
  image_url?: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  display_order: number;
  image_url?: string;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function SortableCategory({ category, onEdit, onDelete, products, onEditProduct, onReorderProducts }: {
  category: Category;
  onEdit: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  products: Product[];
  onEditProduct: (id: string, name: string, description: string, price: number) => void;
  onReorderProducts: (categoryId: string, oldIndex: number, newIndex: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const categoryProducts = products.filter(p => p.category_id === category.id).sort((a, b) => a.display_order - b.display_order);

  const handleSave = () => {
    onEdit(category.id, editName);
    setIsEditing(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleProductDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = categoryProducts.findIndex(p => p.id === active.id);
      const newIndex = categoryProducts.findIndex(p => p.id === over.id);
      onReorderProducts(category.id, oldIndex, newIndex);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-card rounded-lg border p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between flex-1">
            <h3 className="font-semibold">{category.name}</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(category.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProductDragEnd}>
        <SortableContext items={categoryProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {categoryProducts.map((product) => (
              <SortableProduct
                key={product.id}
                product={product}
                onEdit={() => setEditingProduct(product)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editingProduct && (
        <ProductEditDialog
          product={editingProduct}
          onSave={(name, description, price) => {
            onEditProduct(editingProduct.id, name, description, price);
            setEditingProduct(null);
          }}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}

function SortableProduct({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-muted/50 rounded p-3 flex items-center gap-2">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1">
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{product.name}</div>
        <div className="text-xs text-muted-foreground">R$ {product.price.toFixed(2)}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={onEdit}>
        <Edit2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function ProductEditDialog({ product, onSave, onClose }: {
  product: Product;
  onSave: (name: string, description: string, price: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || "");
  const [price, setPrice] = useState(product.price.toString());

  const handleSave = () => {
    onSave(name, description, parseFloat(price));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Preço</label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const AdminPanel = ({ isOpen, onClose }: AdminPanelProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [categoriesRes, productsRes] = await Promise.all([
        supabase.from('categories').select('*').order('display_order'),
        supabase.from('products').select('*').order('display_order')
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;

      setCategories(categoriesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar dados",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const maxOrder = Math.max(...categories.map(c => c.display_order), 0);
      const { error } = await supabase.from('categories').insert({
        id: newCategoryName.toLowerCase().replace(/\s+/g, '-'),
        name: newCategoryName,
        display_order: maxOrder + 1
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria criada com sucesso"
      });

      setNewCategoryName("");
      fetchData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar categoria",
        variant: "destructive"
      });
    }
  };

  const editCategory = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria atualizada"
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar categoria",
        variant: "destructive"
      });
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria removida"
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover categoria",
        variant: "destructive"
      });
    }
  };

  const editProduct = async (id: string, name: string, description: string, price: number) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ name, description, price })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Produto atualizado"
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar produto",
        variant: "destructive"
      });
    }
  };

  const reorderCategories = async (oldIndex: number, newIndex: number) => {
    const newCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCategories);

    try {
      const updates = newCategories.map((category, index) => ({
        id: category.id,
        display_order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('categories')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      toast({
        title: "Sucesso",
        description: "Ordem das categorias atualizada"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao reordenar categorias",
        variant: "destructive"
      });
      fetchData();
    }
  };

  const reorderProducts = async (categoryId: string, oldIndex: number, newIndex: number) => {
    const categoryProducts = products.filter(p => p.category_id === categoryId).sort((a, b) => a.display_order - b.display_order);
    const newProducts = arrayMove(categoryProducts, oldIndex, newIndex);
    
    try {
      const updates = newProducts.map((product, index) => ({
        id: product.id,
        display_order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('products')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      toast({
        title: "Sucesso",
        description: "Ordem dos produtos atualizada"
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao reordenar produtos",
        variant: "destructive"
      });
    }
  };

  const handleCategoryDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = categories.findIndex(c => c.id === active.id);
      const newIndex = categories.findIndex(c => c.id === over.id);
      reorderCategories(oldIndex, newIndex);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Painel Administrativo</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle>Nova Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da categoria"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createCategory()}
                />
                <Button onClick={createCategory} disabled={!newCategoryName.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gerenciar Categorias e Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                  <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {categories.map((category) => (
                      <SortableCategory
                        key={category.id}
                        category={category}
                        onEdit={editCategory}
                        onDelete={deleteCategory}
                        products={products}
                        onEditProduct={editProduct}
                        onReorderProducts={reorderProducts}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};