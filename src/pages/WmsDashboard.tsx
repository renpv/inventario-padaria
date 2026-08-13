import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { OrderPreview } from '../components/OrderPreview';
import type { OrderItem } from '../components/OrderPreview';
import { Package, Truck, AlertTriangle, RefreshCw, ListOrdered } from 'lucide-react';

interface StockItem {
  id_produto: string;
  nome_produto: string;
  nome_setor: string;
  unidade_medida: string;
  estoque_minimo: number;
  estoque_atual: number;
  consumo_periodo: number;
  quantidade_sugerida: number;
  id_fornecedor_sugerido?: string | null;
  fornecedor_sugerido?: string | null;
  valor_unitario_sugerido?: number | null;
}

interface Fornecedor {
  id_fornecedor: string;
  nome: string;
  pedido_minimo: number;
  taxa_entrega: number;
}

const isUUID = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const WmsDashboard: React.FC = () => {
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [fornecedores, setFornecedores] = useState<Record<string, Fornecedor>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierOrderItems, setSupplierOrderItems] = useState<OrderItem[]>([]);
  const [mockMode, setMockMode] = useState(false);

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const [stockRes, fornecedoresRes] = await Promise.all([
          supabase.from('view_dashboard_estoques').select('*'),
          supabase.from('fornecedores').select('id_fornecedor, nome, pedido_minimo, taxa_entrega').eq('ativo', 'SIM'),
        ]);

        if (stockRes.data && stockRes.data.length > 0 && !stockRes.error) {
          setMockMode(false);
          setStockList(stockRes.data as StockItem[]);
          const map: Record<string, Fornecedor> = {};
          for (const f of fornecedoresRes.data || []) map[f.id_fornecedor] = f as Fornecedor;
          setFornecedores(map);
        } else {
          // Ambiente sem dados reais: mantém uma amostra ilustrativa (não é
          // possível registrar pedidos reais neste modo).
          setMockMode(true);
          setStockList([
            {
              id_produto: 'p1',
              nome_produto: 'Farinha de Trigo Especial',
              nome_setor: 'Retaguarda',
              unidade_medida: 'kg',
              estoque_minimo: 50,
              estoque_atual: 20,
              consumo_periodo: 120,
              quantidade_sugerida: 150,
              id_fornecedor_sugerido: 'mock-f1',
              fornecedor_sugerido: 'Distribuidora Trigo Dourado',
              valor_unitario_sugerido: 4.5,
            },
            {
              id_produto: 'p2',
              nome_produto: 'Manteiga com Sal',
              nome_setor: 'Frios',
              unidade_medida: 'pote',
              estoque_minimo: 10,
              estoque_atual: 2,
              consumo_periodo: 15,
              quantidade_sugerida: 23,
              id_fornecedor_sugerido: 'mock-f2',
              fornecedor_sugerido: 'Laticínios Alvorada',
              valor_unitario_sugerido: 18.9,
            },
            {
              id_produto: 'p3',
              nome_produto: 'Fermento Biológico Seco',
              nome_setor: 'Retaguarda',
              unidade_medida: 'pct',
              estoque_minimo: 5,
              estoque_atual: 6,
              consumo_periodo: 8,
              quantidade_sugerida: 7,
              id_fornecedor_sugerido: 'mock-f1',
              fornecedor_sugerido: 'Distribuidora Trigo Dourado',
              valor_unitario_sugerido: 12.0,
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

  const handleSupplierOrder = (id_fornecedor: string) => {
    const items = stockList
      .filter((item) => item.id_fornecedor_sugerido === id_fornecedor && item.quantidade_sugerida > 0)
      .map((item) => ({
        id_produto: item.id_produto,
        nome_produto: item.nome_produto,
        quantidade: item.quantidade_sugerida,
        unidade_medida: item.unidade_medida,
        valor_unitario: item.valor_unitario_sugerido ?? 0,
      }));

    setSupplierOrderItems(items);
    setSelectedSupplierId(id_fornecedor);
  };

  const handleConfirmOrder = async () => {
    if (!selectedSupplierId || !isUUID(selectedSupplierId)) return;

    const fornecedor = fornecedores[selectedSupplierId];
    const valorProdutos = supplierOrderItems.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0);
    const taxaEntrega = fornecedor?.taxa_entrega || 0;

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos_compra')
      .insert({
        id_fornecedor: selectedSupplierId,
        valor_produtos: valorProdutos,
        taxa_entrega: taxaEntrega,
        valor_total: valorProdutos + taxaEntrega,
        status: 'Simulado',
      })
      .select('id_pedido')
      .single();

    if (pedidoError || !pedido) {
      alert('Não foi possível registrar o pedido: ' + (pedidoError?.message || 'erro desconhecido'));
      throw pedidoError;
    }

    const itensPayload = supplierOrderItems.map((i) => ({
      id_pedido: pedido.id_pedido,
      id_produto: i.id_produto,
      quantidade: i.quantidade,
      valor_unit_aplicado: i.valor_unitario,
    }));

    const { error: itensError } = await supabase.from('pedidos_itens').insert(itensPayload);
    if (itensError) {
      alert('Pedido criado, mas houve falha ao gravar os itens: ' + itensError.message);
      throw itensError;
    }
  };

  // Agrupa por fornecedor sugerido (id), usando o de menor preço por
  // produto — já resolvido pela view (RF-16).
  const supplierGroups = stockList.reduce((acc, curr) => {
    if (curr.quantidade_sugerida <= 0 || !curr.id_fornecedor_sugerido) return acc;
    const existing = acc[curr.id_fornecedor_sugerido] || {
      nome: curr.fornecedor_sugerido || 'Fornecedor',
      count: 0,
      totalVal: 0,
    };
    acc[curr.id_fornecedor_sugerido] = {
      nome: existing.nome,
      count: existing.count + 1,
      totalVal: existing.totalVal + curr.quantidade_sugerida * (curr.valor_unitario_sugerido ?? 0),
    };
    return acc;
  }, {} as Record<string, { nome: string; count: number; totalVal: number }>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-400">
        <RefreshCw className="animate-spin text-amber-500 mb-2" size={32} />
        <span>Carregando painel de compras...</span>
      </div>
    );
  }

  const itemsBelowMin = stockList.filter((item) => item.estoque_atual < item.estoque_minimo).length;
  const selectedFornecedor = selectedSupplierId ? fornecedores[selectedSupplierId] : undefined;

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

      <Link
        to="/gestao/pedidos"
        className="flex items-center justify-between bg-stone-850 hover:bg-stone-800 p-4 rounded-xl border border-stone-800 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-stone-200">
          <ListOrdered size={16} className="text-amber-500" /> Pedidos de Compra
        </span>
        <span className="text-xs text-stone-500">Ver todos &rarr;</span>
      </Link>

      {/* Suggested Orders by Supplier */}
      <div className="space-y-3">
        <h2 className="text-xs text-stone-400 font-bold uppercase tracking-wider">Sugestões por Fornecedor</h2>
        <div className="space-y-3">
          {Object.keys(supplierGroups).length === 0 ? (
            <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 text-center text-stone-500 text-sm">
              Nenhuma sugestão de compra pendente. Estoques abastecidos.
            </div>
          ) : (
            Object.entries(supplierGroups).map(([idFornecedor, group]) => (
              <div
                key={idFornecedor}
                className="bg-stone-850 p-4 rounded-xl border border-stone-800 flex items-center justify-between shadow-md"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold text-stone-200 text-sm">{group.nome}</h3>
                  <p className="text-xs text-stone-400">
                    {group.count} itens sugeridos &bull;{' '}
                    <strong className="text-stone-300">
                      R$ {group.totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </p>
                </div>
                <button
                  onClick={() => handleSupplierOrder(idFornecedor)}
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
      {selectedSupplierId && (
        <OrderPreview
          supplierName={supplierGroups[selectedSupplierId]?.nome || 'Fornecedor'}
          items={supplierOrderItems}
          taxaEntrega={selectedFornecedor?.taxa_entrega || 0}
          pedidoMinimo={selectedFornecedor?.pedido_minimo || 0}
          onConfirmOrder={!mockMode ? handleConfirmOrder : undefined}
          onClose={() => setSelectedSupplierId(null)}
        />
      )}
    </div>
  );
};
