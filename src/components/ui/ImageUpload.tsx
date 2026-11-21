import { StorageImage } from "@/components/ui/StorageImage";
import React, { useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Upload, X, Image } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  bucket?: string;
  folder?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  value, 
  onChange, 
  label = "Imagem",
  bucket = "catalog-images",
  folder = ""
}) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const uploadId = React.useMemo(() => `image-upload-${Math.random()}`, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "O arquivo deve ter no máximo 5MB.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (error) throw error;

      // Store the stable public-style URL; StorageImage signs it on display (bucket is private).
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      onChange(publicUrl);
      
      toast({
        title: "Sucesso",
        description: "Imagem enviada com sucesso!",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar a imagem. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    onChange(null);
    toast({
      title: "Imagem removida",
      description: "A imagem foi removida com sucesso.",
    });
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">{label}</Label>
      
      {value ? (
        <div className="space-y-2">
          <div className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-border rounded-lg bg-muted">
            <StorageImage 
              src={value} 
              alt="Imagem atual" 
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveImage}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Remover Imagem
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-border rounded-lg bg-muted">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <div className="space-y-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id={uploadId}
        />
        <Label htmlFor={uploadId}>
          <Button
            variant="outline"
            disabled={uploading}
            className="w-full cursor-pointer"
            asChild
          >
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Selecionar Imagem'}
            </span>
          </Button>
        </Label>
      </div>
    </div>
  );
};