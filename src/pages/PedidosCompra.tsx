import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { ArrowLeft, Truck, Send, Ban, PackageCheck, RefreshCw } from 'lucide-react';

interface Pedido {
  id_pedido: string;
  data_geracao: string;
  valor_total: number;
  status: 'Simulado' | 'Enviado' | 'Recebido' | 'Recebido com Divergências' | 'Cancelado';
  fornecedores: { nome: string } | null;
}

const statusColor: Record<Pedido['status'], string> = {
  Simulado: 'bg-stone-800 text-stone-400',
  Enviado: 'bg-amber-900/50 text-amber-400',
  Recebido: 'bg-emerald-900/50 text-emerald-400',
  'Recebido com Divergências': 'bg-rose-900/40 text-rose-400',
  Cancelado: 'bg-stone-800 text-stone-600 line-through',
};

export const PedidosCompra: React.FC = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadPedidos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pedidos_compra')
      .select('id_pedido, data_geracao, valor_total, status, fornecedores(nome)')
      .order('data_geracao', { ascending: false });

    if (!error && data) setPedidos(data as unknown as Pedido[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const marcarComoEnviado = async (id_pedido: string) => {
    setBusyId(id_pedido);
    const { error } = await supabase.from('pedidos_compra').update({ status: 'Enviado' }).eq('id_pedido', id_pedido);
    if (error) alert('Erro: ' + error.message);
    await loadPedidos();
    setBusyId(null);
  };

  const cancelarPedido = async (id_pedido: string) => {
    if (!window.confirm('Confirma o cancelamento deste pedido? Pedidos cancelados não afetam o estoque.')) return;
    setBusyId(id_pedido);
    const { error } = await supabase.from('pedidos_compra').update({ status: 'Cancelado' }).eq('id_pedido', id_pedido);
    if (error) alert('Erro: ' + error.message);
    await loadPedidos();
    setBusyId(null);
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/wms" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <h2 className="text-lg font-bold text-amber-500">Pedidos de Compra</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-stone-400 text-sm justify-center py-8">
          <RefreshCw className="animate-spin" size={18} /> Carregando pedidos...
        </div>
      ) : pedidos.length === 0 ? (
        <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 text-center text-stone-500 text-sm">
          Nenhum pedido registrado ainda. Gere um pedido pelo painel WMS.
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((p) => (
            <div key={p.id_pedido} className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-stone-200 flex items-center gap-2">
                    <Truck size={14} className="text-amber-500" /> {p.fornecedores?.nome || 'Fornecedor'}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {new Date(p.data_geracao).toLocaleDateString('pt-BR')} &bull; R${' '}
                    {Number(p.valor_total).toFixed(2)}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusColor[p.status]}`}>
                  {p.status}
                </span>
              </div>

              <div className="flex gap-2">
                {p.status === 'Simulado' && (
                  <button
                    onClick={() => marcarComoEnviado(p.id_pedido)}
                    disabled={busyId === p.id_pedido}
                    className="flex-1 py-2 bg-amber-600/20 text-amber-500 border border-amber-600/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Send size={13} /> Marcar como Enviado
                  </button>
                )}
                {p.status === 'Enviado' && (
                  <Link
                    to={`/recebimento?pedido=${p.id_pedido}`}
                    className="flex-1 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <PackageCheck size={13} /> Conferir Recebimento
                  </Link>
                )}
                {!['Recebido', 'Recebido com Divergências', 'Cancelado'].includes(p.status) && (
                  <button
                    onClick={() => cancelarPedido(p.id_pedido)}
                    disabled={busyId === p.id_pedido}
                    className="py-2 px-3 bg-stone-900 text-rose-400 border border-stone-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Ban size={13} /> Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
