import { StorageImage } from "@/components/ui/StorageImage";
import { forwardRef } from "react";

interface PrintItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface PrintReceiptProps {
  customerName: string;
  sellerName?: string;
  items: PrintItem[];
  total: number;
  paymentMethod?: string;
  date?: Date;
  orderNumber?: string;
  storeName?: string;
  storeLogo?: string | null;
  storeAddress?: string;
  storePhone?: string;
  printerWidth?: string;
  printerFontSize?: number;
  printerShowLogo?: boolean;
  printerShowAddress?: boolean;
  printerShowPhone?: boolean;
  printerShowSeller?: boolean;
  printerShowCustomer?: boolean;
  printerShowOrderNumber?: boolean;
  printerShowPaymentMethod?: boolean;
  printerShowDate?: boolean;
  printerHeaderText?: string;
  printerFooterText?: string;
  printerMarginLeft?: number;
}

export const PrintReceipt = forwardRef<HTMLDivElement, PrintReceiptProps>(
  ({ 
    customerName, sellerName, items, total, paymentMethod, date = new Date(), orderNumber, 
    storeName, storeLogo, storeAddress, storePhone,
    printerWidth = '58mm',
    printerFontSize = 10,
    printerShowLogo = true,
    printerShowAddress = true,
    printerShowPhone = true,
    printerShowSeller = true,
    printerShowCustomer = true,
    printerShowOrderNumber = true,
    printerShowPaymentMethod = true,
    printerShowDate = true,
    printerHeaderText = '',
    printerFooterText = 'Obrigado pela preferência!',
    printerMarginLeft = 0,
  }, ref) => {
    const fontSize = `${printerFontSize}px`;
    const headerFontSize = `${printerFontSize + 2}px`;
    const marginLeftMm = Math.max(0, Number(printerMarginLeft) || 0);
    
    return (
      <div ref={ref} className="bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize }}>
        <style>{`
          @media print { 
            @page { 
              size: ${printerWidth} auto; 
              margin: 0 0 0 ${marginLeftMm}mm; 
            } 
            body { 
              margin: 0;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}</style>
        <div className="p-1" style={{ width: printerWidth, marginLeft: `${marginLeftMm}mm` }}>
        
        
        {/* Store Header */}
        <div className="text-center mb-1 border-b border-black pb-1" style={{ fontSize: headerFontSize }}>
          {printerShowLogo && storeLogo && (
            <div className="mb-1 flex justify-center items-center">
              <StorageImage
                src={storeLogo}
                alt={storeName ? `Logo da ${storeName}` : "Logo da loja"}
                className="object-contain mx-auto"
                style={{ height: '7.5em', width: 'auto', maxWidth: `calc(${printerWidth} - 6mm)`, display: 'block' }}
              />
            </div>
          )}
          {printerHeaderText && (
            <p style={{ fontSize }}>{printerHeaderText}</p>
          )}
          <h1 style={{ fontSize: headerFontSize }} className="font-bold mb-1">{storeName || "COMANDA DE VENDA"}</h1>
          {printerShowAddress && storeAddress && (
            <p style={{ fontSize }}>{storeAddress}</p>
          )}
          {printerShowPhone && storePhone && (
            <p style={{ fontSize }}>Tel: {storePhone}</p>
          )}
        </div>

        {/* Order Info */}
        <div className="text-center mb-1 border-b border-gray-300 pb-1">
          {printerShowOrderNumber && orderNumber && (
            <p style={{ fontSize }} className="font-semibold">Pedido: #{orderNumber}</p>
          )}
          {printerShowDate && (
            <p style={{ fontSize }}>
              {date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>

        {/* Customer and Seller Info */}
        <div className="mb-1 space-y-0.5" style={{ fontSize }}>
          {printerShowCustomer && (
            <div className="flex justify-between">
              <span className="font-semibold">Cliente:</span>
              <span className="truncate ml-2">{customerName || "Cliente sem nome"}</span>
            </div>
          )}
          {printerShowSeller && sellerName && (
            <div className="flex justify-between">
              <span className="font-semibold">Vendedor:</span>
              <span className="truncate ml-2">{sellerName}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="mb-1">
          <table className="w-full border-collapse" style={{ fontSize }}>
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-0.5">Produto</th>
                <th className="text-center py-0.5 w-10">Qtd</th>
                <th className="text-right py-0.5 w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-b border-gray-300">
                  <td className="py-0.5">{item.name}</td>
                  <td className="text-center py-0.5">{item.quantity}</td>
                  <td className="text-right py-0.5">R$ {item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-top border-black pt-1 mb-1">
          <div className="flex justify-between font-bold" style={{ fontSize: headerFontSize }}>
            <span>TOTAL:</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
          {printerShowPaymentMethod && paymentMethod && (
            <div className="flex justify-between mt-1" style={{ fontSize }}>
              <span className="font-semibold">Pagamento:</span>
              <span>{paymentMethod}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {printerFooterText && (
          <div className="text-center border-t border-gray-300 pt-1" style={{ fontSize }}>
            <p>{printerFooterText}</p>
          </div>
        )}
        </div>
      </div>
    );
  }
);

PrintReceipt.displayName = "PrintReceipt";
