import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getOperationalDayRangeISO, buildTurnosDoDia } from '../utils/operationalDay';
import type { TurnoDoDia, LancamentoRow } from '../utils/operationalDay';
import { ArrowLeft, Lock, RotateCcw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface Setor {
  id_setor: string;
  nome_setor: string;
}

interface Produto {
  id_produto: string;
  id_setor: string;
}

export const GestaoTurnosDia: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [turnosDoDia, setTurnosDoDia] = useState<(TurnoDoDia & { bloqueado: boolean })[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [expandedTurno, setExpandedTurno] = useState<string | null>(null);
  const [itensPorLancamento, setItensPorLancamento] = useState<Record<string, Set<string>>>({});
  const [reopening, setReopening] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [turnoRes, setorRes, produtoRes] = await Promise.all([
        supabase.from('turnos').select('id_turno, nome_turno, ordem').eq('ativo', 'SIM').order('ordem'),
        supabase.from('setores').select('id_setor, nome_setor').eq('ativo', 'SIM'),
        supabase.from('produtos').select('id_produto, id_setor').eq('ativo', 'SIM'),
      ]);

      setSetores(setorRes.data || []);
      setProdutos(produtoRes.data || []);

      const { startISO, endISO } = getOperationalDayRangeISO();
      const { data: lancamentosHoje } = await supabase
        .from('lancamentos_op')
        .select('id_lancamento, id_turno, status')
        .eq('tipo', 'Inventário')
        .gte('data', startISO)
        .lt('data', endISO);

      setTurnosDoDia(buildTurnosDoDia(turnoRes.data || [], (lancamentosHoje as LancamentoRow[]) || []));
    } catch (err) {
      console.error('Erro ao carregar turnos do dia:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadItensDoLancamento = async (id_lancamento: string) => {
    if (itensPorLancamento[id_lancamento]) return;
    const { data } = await supabase.from('lancamentos_itens').select('id_produto').eq('id_lancamento', id_lancamento);
    setItensPorLancamento((prev) => ({
      ...prev,
      [id_lancamento]: new Set((data || []).map((i: { id_produto: string }) => i.id_produto)),
    }));
  };

  const toggleExpand = async (turno: TurnoDoDia) => {
    if (expandedTurno === turno.id_turno) {
      setExpandedTurno(null);
      return;
    }
    setExpandedTurno(turno.id_turno);
    if (turno.id_lancamento) {
      await loadItensDoLancamento(turno.id_lancamento);
    }
  };

  const handleReabrir = async (id_lancamento: string, id_setor?: string, label?: string) => {
    if (!window.confirm(`Confirma a reabertura ${id_setor ? `do setor "${label}"` : 'deste turno inteiro'}?`)) {
      return;
    }
    setReopening(id_setor ? `${id_lancamento}:${id_setor}` : id_lancamento);
    try {
      const { error } = await supabase.rpc('reabrir_turno', {
        p_id_lancamento: id_lancamento,
        p_id_setor: id_setor || null,
      });
      if (error) {
        alert('Não foi possível reabrir: ' + error.message);
        return;
      }
      await loadData();
      setItensPorLancamento((prev) => {
        const next = { ...prev };
        delete next[id_lancamento];
        return next;
      });
    } finally {
      setReopening(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-400">
        <Loader2 className="animate-spin text-amber-500 mb-2" size={32} />
        <span>Carregando turnos do dia...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto pb-20">
      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/config" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <div>
          <h2 className="text-lg font-bold text-amber-500">Turnos de Hoje</h2>
          <p className="text-xs text-stone-400">Acompanhe e, se necessário, reabra turnos ou setores (RF-21).</p>
        </div>
      </div>

      <div className="space-y-3">
        {turnosDoDia.map((turno) => {
          const isExpanded = expandedTurno === turno.id_turno;
          const itens = turno.id_lancamento ? itensPorLancamento[turno.id_lancamento] : undefined;

          return (
            <div key={turno.id_turno} className="bg-stone-850 rounded-xl border border-stone-800 overflow-hidden">
              <button
                onClick={() => toggleExpand(turno)}
                disabled={!turno.id_lancamento}
                className="w-full p-4 flex items-center justify-between disabled:opacity-60"
              >
                <div className="text-left">
                  <p className="font-bold text-stone-200">{turno.nome_turno}</p>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      turno.status === 'CONFIRMADO'
                        ? 'bg-emerald-900/50 text-emerald-400'
                        : turno.status === 'EM ANDAMENTO'
                        ? 'bg-amber-900/50 text-amber-400'
                        : turno.status === 'NÃO REALIZADO'
                        ? 'bg-rose-900/40 text-rose-400'
                        : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    {turno.status}
                  </span>
                </div>
                {turno.id_lancamento && (isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />)}
              </button>

              {isExpanded && turno.id_lancamento && (
                <div className="border-t border-stone-800 p-4 space-y-3">
                  {(turno.status === 'CONFIRMADO' || turno.status === 'NÃO REALIZADO') && (
                    <button
                      onClick={() => handleReabrir(turno.id_lancamento!)}
                      disabled={reopening === turno.id_lancamento}
                      className="w-full py-2.5 bg-rose-600/20 text-rose-400 border border-rose-600/40 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={16} /> Reabrir turno inteiro
                    </button>
                  )}

                  <div className="space-y-2">
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Setores</p>
                    {setores
                      .filter((s) => produtos.some((p) => p.id_setor === s.id_setor))
                      .map((setor) => {
                        const produtosDoSetor = produtos.filter((p) => p.id_setor === setor.id_setor);
                        const concluido = itens ? produtosDoSetor.every((p) => itens.has(p.id_produto)) : false;
                        const key = `${turno.id_lancamento}:${setor.id_setor}`;
                        return (
                          <div key={setor.id_setor} className="flex items-center justify-between text-sm bg-stone-900 p-2.5 rounded-lg">
                            <span className="text-stone-300">{setor.nome_setor}</span>
                            <div className="flex items-center gap-2">
                              <span className={concluido ? 'text-emerald-500 text-xs' : 'text-stone-500 text-xs'}>
                                {concluido ? 'Concluído' : 'Pendente'}
                              </span>
                              {concluido && (
                                <button
                                  onClick={() => handleReabrir(turno.id_lancamento!, setor.id_setor, setor.nome_setor)}
                                  disabled={reopening === key}
                                  className="p-1.5 text-rose-400 hover:bg-rose-900/20 rounded"
                                  title="Reabrir apenas este setor"
                                >
                                  <RotateCcw size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {!turno.id_lancamento && (
                <div className="px-4 pb-4 text-xs text-stone-500 flex items-center gap-2">
                  <Lock size={12} /> Turno ainda não iniciado hoje.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
