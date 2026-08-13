import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { getOperationalDayRangeISO, buildTurnosDoDia } from '../utils/operationalDay';
import type { TurnoDoDia, LancamentoRow } from '../utils/operationalDay';
import { Clock, RefreshCw } from 'lucide-react';

/**
 * Painel "status de todos os turnos do dia" (RF-19 — dashboard operacional).
 * Reaproveitado tanto pela área operacional quanto pela gestão.
 */
export const TurnosStatusPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [turnos, setTurnos] = useState<(TurnoDoDia & { bloqueado: boolean })[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: turnoData } = await supabase
          .from('turnos')
          .select('id_turno, nome_turno, ordem')
          .eq('ativo', 'SIM')
          .order('ordem');

        if (!turnoData || turnoData.length === 0) {
          setTurnos([]);
          return;
        }

        const { startISO, endISO } = getOperationalDayRangeISO();
        const { data: lancamentosHoje } = await supabase
          .from('lancamentos_op')
          .select('id_lancamento, id_turno, status')
          .eq('tipo', 'Inventário')
          .gte('data', startISO)
          .lt('data', endISO);

        setTurnos(buildTurnosDoDia(turnoData, (lancamentosHoje as LancamentoRow[]) || []));
      } catch (err) {
        console.error('Erro ao carregar status dos turnos:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const turnoAtual = turnos.find((t) => !t.bloqueado && t.status !== 'CONFIRMADO');

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-stone-400 text-sm">
        <RefreshCw className="animate-spin" size={16} /> Carregando turnos do dia...
      </div>
    );
  }

  if (turnos.length === 0) {
    return <div className="text-stone-500 text-sm">Nenhum turno configurado.</div>;
  }

  return (
    <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-3">
      <div className="flex items-center gap-2 text-amber-500">
        <Clock size={18} />
        <h3 className="font-bold text-sm">Turnos de Hoje</h3>
      </div>
      <div className="space-y-2">
        {turnos.map((t) => (
          <div
            key={t.id_turno}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
              turnoAtual?.id_turno === t.id_turno ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-stone-900'
            }`}
          >
            <span className="text-stone-300">{t.nome_turno}</span>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                t.status === 'CONFIRMADO'
                  ? 'bg-emerald-900/50 text-emerald-400'
                  : t.status === 'EM ANDAMENTO'
                  ? 'bg-amber-900/50 text-amber-400'
                  : t.status === 'NÃO REALIZADO'
                  ? 'bg-rose-900/40 text-rose-400'
                  : 'bg-stone-800 text-stone-500'
              }`}
            >
              {t.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
