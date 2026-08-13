import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { computeRunningBalances } from '../utils/fiadoCalculations';

export interface CreditMovement {
  id_movimento: string;
  data: string;
  tipo: string;
  valor: number;
  observacao: string | null;
}

interface StaffCreditHistoryProps {
  funcionarioId: string;
  isGestor: boolean;
  onMovementUpdated?: () => void;
}

export const StaffCreditHistory: React.FC<StaffCreditHistoryProps> = ({ funcionarioId, isGestor, onMovementUpdated }) => {
  const [movements, setMovements] = useState<(CreditMovement & { saldoApos: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovements();
  }, [funcionarioId]);

  const fetchMovements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('credito_movimentos')
      .select('id_movimento, data, tipo, valor, observacao')
      .eq('id_funcionario', funcionarioId)
      .order('data', { ascending: true });

    if (error) {
      console.error('Error fetching credit movements:', error);
      setLoading(false);
      return;
    }

    const computed = computeRunningBalances(data || []);
    setMovements(computed.reverse()); // Show newest first
    setLoading(false);
  };

  const handleDelete = async (id_movimento: string) => {
    if (!isGestor) return;
    if (window.confirm('Tem certeza que deseja excluir esta movimentação? (Ação irreversível)')) {
      const { error } = await supabase.from('credito_movimentos').delete().eq('id_movimento', id_movimento);
      if (!error) {
        fetchMovements();
        if (onMovementUpdated) onMovementUpdated();
      } else {
        alert('Erro ao excluir: ' + error.message);
      }
    }
  };

  if (loading) return <div className="text-stone-400">Carregando extrato...</div>;

  return (
    <div className="bg-stone-850 rounded-xl border border-stone-800 overflow-hidden">
      <div className="p-4 bg-stone-800 border-b border-stone-700">
        <h3 className="font-bold text-stone-200">Extrato de Movimentações</h3>
      </div>
      <div className="divide-y divide-stone-800">
        {movements.length === 0 ? (
          <div className="p-4 text-stone-500 text-center text-sm">Nenhuma movimentação registrada.</div>
        ) : (
          movements.map((mov) => (
            <div key={mov.id_movimento} className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-stone-200">{mov.tipo}</p>
                <p className="text-xs text-stone-500">{new Date(mov.data).toLocaleString('pt-BR')}</p>
                {mov.observacao && <p className="text-xs text-stone-400 mt-1 italic">"{mov.observacao}"</p>}
              </div>
              <div className="text-right flex items-center gap-4">
                <div>
                  <p className={`text-sm font-bold ${(mov.tipo === 'Adiantamento' || mov.tipo === 'Retirada de produto') ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {(mov.tipo === 'Adiantamento' || mov.tipo === 'Retirada de produto') ? '+' : '-'} R$ {Number(mov.valor).toFixed(2)}
                  </p>
                  <p className="text-xs text-stone-400">Saldo: R$ {mov.saldoApos.toFixed(2)}</p>
                </div>
                {isGestor && (
                  <button onClick={() => handleDelete(mov.id_movimento)} className="p-2 text-stone-500 hover:text-rose-500 transition-colors" title="Excluir">
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
