import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { OrderPreview } from '../components/OrderPreview';
import type { OrderItem } from '../components/OrderPreview';
import { Package, Truck, AlertTriangle, RefreshCw } from 'lucide-react';

interface StockItem {
  id_produto: string;
  nome_produto: string;
  nome_setor: string;
  unidade_medida: string;
  estoque_minimo: number;
  estoque_atual: number;
  consumo_periodo: number;
  quantidade_sugerida: number;
  fornecedor_principal?: string;
  valor_unitario?: number;
}

export const WmsDashboard: React.FC = () => {
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [supplierOrderItems, setSupplierOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const { data, error } = await supabase
          .from('view_dashboard_estoques')
          .select('*');

        if (data && data.length > 0 && !error) {
          // Mocking supplier binding since view doesn't have it directly
          const boundData = data.map((item: any, idx: number) => ({
            ...item,
            fornecedor_principal: idx % 2 === 0 ? 'Distribuidora Trigo Dourado' : 'Laticínios Alvorada',
            valor_unitario: idx % 2 === 0 ? 4.50 : 18.90,
          }));
          setStockList(boundData);
        } else {
          // Mock data fallback
          setStockList([
            {
              id_produto: 'p1',
              nome_produto: 'Farinha de Trigo Especial',
              nome_setor: 'Retaguarda',
              unidade_medida: 'kg',
              estoque_minimo: 50,
              estoque_atual: 20,
              consumo_periodo: 120,
              quantidade_sugerida: 150, // (120+50) - (20+0) = 150
              fornecedor_principal: 'Distribuidora Trigo Dourado',
              valor_unitario: 4.50,
            },
            {
              id_produto: 'p2',
              nome_produto: 'Manteiga com Sal',
              nome_setor: 'Frios',
              unidade_medida: 'pote',
              estoque_minimo: 10,
              estoque_atual: 2,
              consumo_periodo: 15,
              quantidade_sugerida: 23, // (15+10) - (2+0) = 23
              fornecedor_principal: 'Laticínios Alvorada',
              valor_unitario: 18.90,
            },
            {
              id_produto: 'p3',
              nome_produto: 'Fermento Biológico Seco',
              nome_setor: 'Retaguarda',
              unidade_medida: 'pct',
              estoque_minimo: 5,
              estoque_atual: 6,
              consumo_periodo: 8,
              quantidade_sugerida: 7, // (8+5) - (6+0) = 7
              fornecedor_principal: 'Distribuidora Trigo Dourado',
              valor_unitario: 12.00,
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to load WMS data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, []);

  const handleSupplierOrder = (supplier: string) => {
    const items = stockList
      .filter((item) => item.fornecedor_principal === supplier && item.quantidade_sugerida > 0)
      .map((item) => ({
        id_produto: item.id_produto,
        nome_produto: item.nome_produto,
        quantidade: item.quantidade_sugerida,
        unidade_medida: item.unidade_medida,
        valor_unitario: item.valor_unitario ?? 0,
      }));

    setSupplierOrderItems(items);
    setSelectedSupplier(supplier);
  };

  // Group by supplier
  const supplierGroups = stockList.reduce((acc, curr) => {
    if (curr.quantidade_sugerida <= 0 || !curr.fornecedor_principal) return acc;
    const existing = acc[curr.fornecedor_principal] || { count: 0, totalVal: 0 };
    acc[curr.fornecedor_principal] = {
      count: existing.count + 1,
      totalVal: existing.totalVal + curr.quantidade_sugerida * (curr.valor_unitario ?? 0),
    };
    return acc;
  }, {} as Record<string, { count: number; totalVal: number }>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-400">
        <RefreshCw className="animate-spin text-amber-500 mb-2" size={32} />
        <span>Carregando painel de compras...</span>
      </div>
    );
  }

  const itemsBelowMin = stockList.filter((item) => item.estoque_atual < item.estoque_minimo).length;

  return (
    <div className="space-y-6">
      {/* Stock Health Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-1">
          <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase">
            <Package size={14} className="text-amber-500" />
            Total de Itens
          </div>
          <span className="text-2xl font-bold text-stone-100">{stockList.length}</span>
        </div>
        <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-1">
          <div className="flex items-center gap-2 text-stone-400 text-xs font-bold uppercase">
            <AlertTriangle size={14} className="text-rose-500" />
            Abaixo do Mínimo
          </div>
          <span className="text-2xl font-bold text-rose-400">{itemsBelowMin}</span>
        </div>
      </div>

      {/* Suggested Orders by Supplier */}
      <div className="space-y-3">
        <h2 className="text-xs text-stone-400 font-bold uppercase tracking-wider">Sugestões por Fornecedor</h2>
        <div className="space-y-3">
          {Object.keys(supplierGroups).length === 0 ? (
            <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 text-center text-stone-500 text-sm">
              Nenhuma sugestão de compra pendente. Estoques abastecidos.
            </div>
          ) : (
            Object.entries(supplierGroups).map(([supplierName, group]) => (
              <div
                key={supplierName}
                className="bg-stone-850 p-4 rounded-xl border border-stone-800 flex items-center justify-between shadow-md"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold text-stone-200 text-sm">{supplierName}</h3>
                  <p className="text-xs text-stone-400">
                    {group.count} itens sugeridos &bull;{' '}
                    <strong className="text-stone-300">
                      R$ {group.totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </p>
                </div>
                <button
                  onClick={() => handleSupplierOrder(supplierName)}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                >
                  <Truck size={14} /> Pedir
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* WhatsApp Order Preview Modal */}
      {selectedSupplier && (
        <OrderPreview
          supplierName={selectedSupplier}
          items={supplierOrderItems}
          onClose={() => setSelectedSupplier(null)}
        />
      )}
    </div>
  );
};
