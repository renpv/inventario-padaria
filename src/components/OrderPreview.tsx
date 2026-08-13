import React, { useState } from 'react';
import { Copy, MessageSquare, X, Check, ClipboardCheck, AlertTriangle } from 'lucide-react';

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
  /** Taxa de entrega do fornecedor, somada ao total do pedido. */
  taxaEntrega?: number;
  /** Pedido mínimo do fornecedor — abaixo disso, exige confirmação explícita (RF-16). */
  pedidoMinimo?: number;
  /**
   * Se informado, habilita o botão "Registrar Pedido", que grava o pedido de
   * verdade (pedidos_compra + pedidos_itens, status Simulado) em vez de
   * apenas gerar um texto para compartilhar.
   */
  onConfirmOrder?: () => Promise<void>;
}

export const OrderPreview: React.FC<OrderPreviewProps> = ({
  supplierName,
  items,
  onClose,
  taxaEntrega = 0,
  pedidoMinimo = 0,
  onConfirmOrder,
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmandoAbaixoMinimo, setConfirmandoAbaixoMinimo] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [registrado, setRegistrado] = useState(false);

  const calculateSubtotal = () => items.reduce((acc, curr) => acc + curr.quantidade * curr.valor_unitario, 0);
  const subtotal = calculateSubtotal();
  const total = subtotal + taxaEntrega;
  const abaixoDoMinimo = pedidoMinimo > 0 && subtotal < pedidoMinimo;

  const generateMessageText = () => {
    let text = `*Pedido de Compra - Padaria WMS*\n`;
    text += `*Fornecedor:* ${supplierName}\n`;
    text += `-------------------------------------\n`;
    items.forEach((item) => {
      const itemSubtotal = item.quantidade * item.valor_unitario;
      text += `- ${item.nome_produto}: ${item.quantidade} ${item.unidade_medida} (R$ ${item.valor_unitario.toFixed(
        2
      )}/un) = R$ ${itemSubtotal.toFixed(2)}\n`;
    });
    text += `-------------------------------------\n`;
    if (taxaEntrega > 0) text += `*Taxa de entrega:* R$ ${taxaEntrega.toFixed(2)}\n`;
    text += `*Valor Total:* R$ ${total.toFixed(2)}`;
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

  const handleRegistrarClick = async () => {
    if (!onConfirmOrder) return;
    if (abaixoDoMinimo && !confirmandoAbaixoMinimo) {
      setConfirmandoAbaixoMinimo(true);
      return;
    }
    setRegistrando(true);
    try {
      await onConfirmOrder();
      setRegistrado(true);
    } finally {
      setRegistrando(false);
    }
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

        {abaixoDoMinimo && (
          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-950/30 p-3 rounded-xl border border-amber-900">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              O subtotal (R$ {subtotal.toFixed(2)}) está abaixo do pedido mínimo deste fornecedor (R${' '}
              {pedidoMinimo.toFixed(2)}). Você pode prosseguir mesmo assim, mediante confirmação.
            </span>
          </div>
        )}

        {/* Total Price summary */}
        <div className="space-y-1 border-t border-stone-800 pt-3">
          {taxaEntrega > 0 && (
            <div className="flex justify-between items-baseline text-xs text-stone-400">
              <span>Taxa de entrega</span>
              <span>R$ {taxaEntrega.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-stone-400 font-bold uppercase">Total Estimado</span>
            <span className="text-xl font-bold text-amber-500">
              R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
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

        {onConfirmOrder && (
          <button
            onClick={handleRegistrarClick}
            disabled={registrando || registrado}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-stone-900 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <ClipboardCheck size={16} />
            {registrado
              ? 'Pedido registrado!'
              : registrando
              ? 'Registrando...'
              : abaixoDoMinimo && !confirmandoAbaixoMinimo
              ? 'Prosseguir abaixo do mínimo'
              : 'Registrar Pedido (Simulado)'}
          </button>
        )}
      </div>
    </div>
  );
};
