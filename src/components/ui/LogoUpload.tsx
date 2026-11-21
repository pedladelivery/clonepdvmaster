import { StorageImage } from "@/components/ui/StorageImage";
import React, { useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Upload, X, Image } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LogoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export const LogoUpload: React.FC<LogoUploadProps> = ({ value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

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

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "O arquivo deve ter no máximo 2MB.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`;
      
      const { data, error } = await supabase.storage
        .from('logos')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(data.path);

      onChange(publicUrl);
      
      toast({
        title: "Sucesso",
        description: "Logo enviada com sucesso!",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar a logo. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    onChange(null);
    toast({
      title: "Logo removida",
      description: "A logo foi removida com sucesso.",
    });
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Logo do Restaurante</Label>
      
      {value ? (
        <div className="space-y-2">
          <div className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <StorageImage 
              src={value} 
              alt="Logo atual" 
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveLogo}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Remover Logo
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <Image className="h-8 w-8 text-gray-400" />
        </div>
      )}

      <div className="space-y-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id="logo-upload"
        />
        <Label htmlFor="logo-upload">
          <Button
            variant="outline"
            disabled={uploading}
            className="w-full cursor-pointer"
            asChild
          >
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Selecionar Logo'}
            </span>
          </Button>
        </Label>
      </div>
    </div>
  );
};