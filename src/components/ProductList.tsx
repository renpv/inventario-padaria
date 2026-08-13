import React from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';

export interface Product {
  id_produto: string;
  nome_produto: string;
  unidade_medida: string;
}

export interface InventoryItem {
  id_produto: string;
  qtd_loja: number;
  qtd_estoque: number;
}

interface ProductListProps {
  products: Product[];
  items: Record<string, InventoryItem>;
  onCountChange: (productId: string, field: 'qtd_loja' | 'qtd_estoque', val: number) => void;
}

export const ProductList: React.FC<ProductListProps> = ({ products, items, onCountChange }) => {
  const getItemValue = (productId: string, field: 'qtd_loja' | 'qtd_estoque') => {
    return items[productId]?.[field] ?? 0;
  };

  const adjustCount = (productId: string, field: 'qtd_loja' | 'qtd_estoque', amount: number) => {
    const current = getItemValue(productId, field);
    const newValue = Math.max(0, current + amount);
    onCountChange(productId, field, newValue);
  };

  return (
    <div className="space-y-4">
      {products.map((product) => (
        <div
          key={product.id_produto}
          className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-3 shadow-md"
        >
          {/* Header Product Info */}
          <div className="flex items-baseline justify-between border-b border-stone-800 pb-2">
            <h3 className="font-semibold text-stone-200">{product.nome_produto}</h3>
            <span className="text-xs text-stone-500 uppercase font-bold">{product.unidade_medida}</span>
          </div>

          {/* Counts Adjustment Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Qtd Loja */}
            <div className="space-y-1">
              <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Loja</label>
              <div className="flex items-center justify-between bg-stone-900 border border-stone-800 rounded-lg p-1">
                <button
                  onClick={() => adjustCount(product.id_produto, 'qtd_loja', -1)}
                  className="p-1.5 hover:bg-stone-800 rounded text-stone-400 hover:text-stone-100 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="0"
                  value={getItemValue(product.id_produto, 'qtd_loja')}
                  onChange={(e) =>
                    onCountChange(product.id_produto, 'qtd_loja', parseFloat(e.target.value) || 0)
                  }
                  className="w-12 bg-transparent text-center text-sm font-semibold text-stone-200 focus:outline-none"
                />
                <button
                  onClick={() => adjustCount(product.id_produto, 'qtd_loja', 1)}
                  className="p-1.5 hover:bg-stone-800 rounded text-stone-400 hover:text-stone-100 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Qtd Estoque */}
            <div className="space-y-1">
              <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Estoque (Retaguarda)</label>
              <div className="flex items-center justify-between bg-stone-900 border border-stone-800 rounded-lg p-1">
                <button
                  onClick={() => adjustCount(product.id_produto, 'qtd_estoque', -1)}
                  className="p-1.5 hover:bg-stone-800 rounded text-stone-400 hover:text-stone-100 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="0"
                  value={getItemValue(product.id_produto, 'qtd_estoque')}
                  onChange={(e) =>
                    onCountChange(product.id_produto, 'qtd_estoque', parseFloat(e.target.value) || 0)
                  }
                  className="w-12 bg-transparent text-center text-sm font-semibold text-stone-200 focus:outline-none"
                />
                <button
                  onClick={() => adjustCount(product.id_produto, 'qtd_estoque', 1)}
                  className="p-1.5 hover:bg-stone-800 rounded text-stone-400 hover:text-stone-100 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Zero Button */}
          <button
            onClick={() => {
              onCountChange(product.id_produto, 'qtd_loja', 0);
              onCountChange(product.id_produto, 'qtd_estoque', 0);
            }}
            className="w-full py-1.5 bg-stone-900/50 hover:bg-stone-800 text-[10px] text-stone-500 hover:text-amber-500 font-bold uppercase tracking-wider rounded-lg border border-stone-800/80 transition-all flex items-center justify-center gap-1"
          >
            <RotateCcw size={12} />
            Zerar Contagem
          </button>
        </div>
      ))}
    </div>
  );
};
