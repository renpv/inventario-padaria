import React, { useState } from 'react';
import { Copy, MessageSquare, X, Check } from 'lucide-react';

export interface OrderItem {
  id_produto: string;
  nome_produto: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
}

interface OrderPreviewProps {
  supplierName: string;
  items: OrderItem[];
  onClose: () => void;
}

export const OrderPreview: React.FC<OrderPreviewProps> = ({ supplierName, items, onClose }) => {
  const [copied, setCopied] = useState(false);

  const calculateTotal = () => {
    return items.reduce((acc, curr) => acc + curr.quantidade * curr.valor_unitario, 0);
  };

  const generateMessageText = () => {
    let text = `*Pedido de Compra - Padaria WMS*\n`;
    text += `*Fornecedor:* ${supplierName}\n`;
    text += `-------------------------------------\n`;
    items.forEach((item) => {
      const subtotal = item.quantidade * item.valor_unitario;
      text += `- ${item.nome_produto}: ${item.quantidade} ${item.unidade_medida} (R$ ${item.valor_unitario.toFixed(
        2
      )}/un) = R$ ${subtotal.toFixed(2)}\n`;
    });
    text += `-------------------------------------\n`;
    text += `*Valor Total:* R$ ${calculateTotal().toFixed(2)}`;
    return text;
  };

  const handleCopy = () => {
    const text = generateMessageText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(generateMessageText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-stone-855 border border-stone-800 p-6 rounded-2xl w-full max-w-sm space-y-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-500 hover:text-stone-300 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-stone-100">Visualizar Pedido</h3>
          <p className="text-xs text-stone-400">Revisão final de suprimentos para {supplierName}</p>
        </div>

        {/* Item List Scroll Area */}
        <div className="bg-stone-900 border border-stone-800/80 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 text-xs">
          {items.map((item) => (
            <div key={item.id_produto} className="flex justify-between text-stone-300">
              <span>
                {item.nome_produto} ({item.quantidade} {item.unidade_medida})
              </span>
              <span className="font-semibold text-stone-200">
                R$ {(item.quantidade * item.valor_unitario).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Total Price summary */}
        <div className="flex justify-between items-baseline border-t border-stone-800 pt-3">
          <span className="text-xs text-stone-400 font-bold uppercase">Total Estimado</span>
          <span className="text-xl font-bold text-amber-500">
            R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopy}
            className="py-3 bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-bold rounded-xl border border-stone-700 transition-colors flex items-center justify-center gap-1.5"
          >
            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            {copied ? 'Copiado!' : 'Copiar Texto'}
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="py-3 bg-emerald-600 hover:bg-emerald-500 text-stone-100 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <MessageSquare size={16} />
            Enviar WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};
