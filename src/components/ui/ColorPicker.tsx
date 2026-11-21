import React from 'react';
import { Input } from './input';
import { Label } from './label';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ 
  label, 
  value, 
  onChange, 
  className = "" 
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={`color-${label}`} className="text-sm font-medium">
        {label}
      </Label>
      <div className="flex items-center space-x-2">
        <Input
          id={`color-${label}`}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-10 p-1 rounded cursor-pointer"
        />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1"
        />
      </div>
    </div>
  );
};