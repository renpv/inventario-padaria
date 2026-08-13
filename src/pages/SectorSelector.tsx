import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getOperationalDayRangeISO, buildTurnosDoDia } from '../utils/operationalDay';
import type { TurnoDoDia, LancamentoRow } from '../utils/operationalDay';
import { cacheActiveLancamento } from '../services/offlineQueue';
import { ClipboardList, LayoutGrid, Loader2, Lock, CheckCircle2, Circle, Flag } from 'lucide-react';

interface Sector {
  id_setor: string;
  nome_setor: string;
}

interface Produto {
  id_produto: string;
  id_setor: string;
}

const isUUID = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const SectorSelector: React.FC = () => {
  const navigate = useNavigate();

  const [mockMode, setMockMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [turnosDoDia, setTurnosDoDia] = useState<(TurnoDoDia & { bloqueado: boolean })[]>([]);
  const [selectedTurnoId, setSelectedTurnoId] = useState<string>('');
  const [enteringTurno, setEnteringTurno] = useState(false);
  const [itensGravados, setItensGravados] = useState<Set<string>>(new Set());

  const [showEncerrarModal, setShowEncerrarModal] = useState(false);
  const [justificativaEncerramento, setJustificativaEncerramento] = useState('');
  const [encerrando, setEncerrando] = useState(false);

  const selectedTurno = turnosDoDia.find((t) => t.id_turno === selectedTurnoId) || null;

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [sectorRes, turnoRes, produtoRes] = await Promise.all([
        supabase.from('setores').select('id_setor, nome_setor').eq('ativo', 'SIM'),
        supabase.from('turnos').select('id_turno, nome_turno, ordem').eq('ativo', 'SIM').order('ordem'),
        supabase.from('produtos').select('id_produto, id_setor').eq('ativo', 'SIM'),
      ]);

      const hasRealData = !!(turnoRes.data && turnoRes.data.length > 0 && sectorRes.data && sectorRes.data.length > 0);

      if (!hasRealData) {
        // Ambiente sem dados reais (demo/E2E): mantemos o comportamento
        // simplificado anterior, sem bloqueio sequencial nem self-healing,
        // já que essas rotinas dependem de RPCs que exigem UUIDs reais.
        setMockMode(true);
        setSectors([
          { id_setor: '1', nome_setor: 'Padaria' },
          { id_setor: '2', nome_setor: 'Confeitaria' },
          { id_setor: '3', nome_setor: 'Frios & Laticínios' },
        ]);
        setProdutos([]);
        const mockTurnos = [
          { id_turno: 't1', nome_turno: 'Manhã - entrada', ordem: 1 },
          { id_turno: 't2', nome_turno: 'Manhã - saída', ordem: 2 },
          { id_turno: 't3', nome_turno: 'Tarde - entrada', ordem: 3 },
          { id_turno: 't4', nome_turno: 'Tarde - saída', ordem: 4 },
        ];
        const built = buildTurnosDoDia(mockTurnos, []);
        setTurnosDoDia(built);
        setSelectedTurnoId(built[0]?.id_turno || '');
        return;
      }

      setMockMode(false);
      setSectors(sectorRes.data || []);
      setProdutos(produtoRes.data || []);

      const { startISO, endISO } = getOperationalDayRangeISO();
      const { data: lancamentosHoje } = await supabase
        .from('lancamentos_op')
        .select('id_lancamento, id_turno, status')
        .eq('tipo', 'Inventário')
        .gte('data', startISO)
        .lt('data', endISO);

      const built = buildTurnosDoDia(turnoRes.data || [], (lancamentosHoje as LancamentoRow[]) || []);
      setTurnosDoDia(built);

      // Seleciona por padrão o primeiro turno não bloqueado que ainda não
      // foi confirmado (ou seja, o turno "da vez").
      const candidato = built.find((t) => !t.bloqueado && t.status !== 'CONFIRMADO');
      setSelectedTurnoId(candidato?.id_turno || built[0]?.id_turno || '');
    } catch (err) {
      console.error('Erro ao buscar dados operacionais:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  // Ao selecionar um turno real (não bloqueado), "inicia" o turno de fato:
  // chama a RPC iniciar_turno, que roda o self-healing e cria/reaproveita o
  // lançamento do dia (RF-02, RF-07, RF-08).
  useEffect(() => {
    if (mockMode || !selectedTurnoId || !isUUID(selectedTurnoId)) return;

    const turno = turnosDoDia.find((t) => t.id_turno === selectedTurnoId);
    if (!turno || turno.bloqueado || turno.status === 'CONFIRMADO') {
      setItensGravados(new Set());
      return;
    }

    let cancelled = false;

    const enter = async () => {
      setEnteringTurno(true);
      try {
        const { data: idLancamento, error } = await supabase.rpc('iniciar_turno', {
          target_id_turno: selectedTurnoId,
          data_operacional: new Date().toISOString(),
        });

        if (error || !idLancamento) {
          console.error('Falha ao iniciar turno:', error);
          return;
        }

        if (cancelled) return;

        await cacheActiveLancamento(selectedTurnoId, idLancamento);

        // Self-healing pode ter alterado o status de turnos anteriores:
        // recarrega a visão do dia para refletir isso na UI.
        const { startISO, endISO } = getOperationalDayRangeISO();
        const [turnoRes, lancamentosRes, itensRes] = await Promise.all([
          supabase.from('turnos').select('id_turno, nome_turno, ordem').eq('ativo', 'SIM').order('ordem'),
          supabase
            .from('lancamentos_op')
            .select('id_lancamento, id_turno, status')
            .eq('tipo', 'Inventário')
            .gte('data', startISO)
            .lt('data', endISO),
          supabase.from('lancamentos_itens').select('id_produto').eq('id_lancamento', idLancamento),
        ]);

        if (cancelled) return;

        setTurnosDoDia(buildTurnosDoDia(turnoRes.data || [], (lancamentosRes.data as LancamentoRow[]) || []));
        setItensGravados(new Set((itensRes.data || []).map((i: { id_produto: string }) => i.id_produto)));
      } finally {
        if (!cancelled) setEnteringTurno(false);
      }
    };

    enter();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTurnoId, mockMode]);

  const handleSectorSelect = (sectorId: string) => {
    if (!selectedTurnoId) return;
    if (selectedTurno?.bloqueado) return;
    navigate(`/inventario/${selectedTurnoId}/${sectorId}`);
  };

  const sectorsWithProgress = sectors.map((s) => {
    const produtosDoSetor = produtos.filter((p) => p.id_setor === s.id_setor);
    const concluido =
      !mockMode &&
      produtosDoSetor.length > 0 &&
      produtosDoSetor.every((p) => itensGravados.has(p.id_produto));
    return { ...s, temProdutos: mockMode || produtosDoSetor.length > 0, concluido };
  });

  // Só listamos setores que têm ao menos um produto ativo (RF-03), exceto no
  // modo mock, onde não temos como checar produtos reais.
  const visibleSectors = sectorsWithProgress.filter((s) => s.temProdutos);

  const todosSetoresConcluidos = !mockMode && visibleSectors.length > 0 && visibleSectors.every((s) => s.concluido);

  const handleEncerrarTurno = async (justificativa?: string) => {
    if (!selectedTurno?.id_lancamento) return;
    setEncerrando(true);
    try {
      const { error } = await supabase.rpc('encerrar_turno', {
        p_id_lancamento: selectedTurno.id_lancamento,
        p_justificativa: justificativa || null,
      });

      if (error) {
        alert('Não foi possível encerrar o turno: ' + error.message);
        return;
      }

      setShowEncerrarModal(false);
      setJustificativaEncerramento('');
      await loadBaseData();
    } finally {
      setEncerrando(false);
    }
  };

  const handleEncerrarClick = () => {
    if (todosSetoresConcluidos) {
      handleEncerrarTurno();
    } else {
      setShowEncerrarModal(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-400">
        <Loader2 className="animate-spin text-amber-500 mb-2" size={32} />
        <span>Carregando setores e turnos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-4">
        <div className="flex items-center gap-2 text-amber-500">
          <ClipboardList size={22} />
          <h2 className="text-lg font-bold">Iniciar Inventário</h2>
        </div>
        <p className="text-xs text-stone-400">Selecione o turno operacional ativo e o setor físico para iniciar a contagem.</p>
      </div>

      {/* Shift Picker */}
      <div className="space-y-2">
        <label className="text-xs text-stone-400 font-bold uppercase">Turno Operacional</label>
        <div className="space-y-2">
          {turnosDoDia.map((turno) => {
            const isSelected = turno.id_turno === selectedTurnoId;
            const isLocked = turno.bloqueado;
            return (
              <button
                key={turno.id_turno}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) {
                    alert(`"${turno.nome_turno}" está bloqueado até o turno anterior ser encerrado.`);
                    return;
                  }
                  setSelectedTurnoId(turno.id_turno);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                  isLocked
                    ? 'bg-stone-900/50 border-stone-800 text-stone-600 cursor-not-allowed'
                    : isSelected
                    ? 'bg-amber-600/10 border-amber-500 text-stone-100'
                    : 'bg-stone-850 border-stone-800 text-stone-300 hover:border-stone-700'
                }`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {isLocked && <Lock size={14} />}
                  {turno.nome_turno}
                </span>
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
              </button>
            );
          })}
        </div>
      </div>

      {enteringTurno && (
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <Loader2 className="animate-spin" size={14} /> Preparando turno...
        </div>
      )}

      {/* Sectors Grid */}
      {selectedTurno && !selectedTurno.bloqueado && (
        <div className="space-y-3">
          <label className="text-xs text-stone-400 font-bold uppercase">Setores Disponíveis</label>
          <div className="grid grid-cols-1 gap-3">
            {visibleSectors.map((sector) => (
              <button
                key={sector.id_setor}
                onClick={() => handleSectorSelect(sector.id_setor)}
                disabled={selectedTurno.status === 'CONFIRMADO'}
                className="flex items-center justify-between bg-stone-850 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/50 p-4 rounded-xl text-left transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:bg-amber-500 group-hover:text-stone-900 transition-colors">
                    <LayoutGrid size={18} />
                  </div>
                  <span className="font-semibold text-stone-200">{sector.nome_setor}</span>
                </div>
                {sector.concluido ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-500 font-bold">
                    <CheckCircle2 size={16} /> Concluído
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-stone-500 group-hover:text-amber-500 transition-colors">
                    <Circle size={14} /> Contar &rarr;
                  </span>
                )}
              </button>
            ))}
          </div>

          {!mockMode && selectedTurno.status === 'EM ANDAMENTO' && (
            <button
              onClick={handleEncerrarClick}
              disabled={encerrando}
              className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                todosSetoresConcluidos
                  ? 'bg-amber-600 hover:bg-amber-500 text-stone-900'
                  : 'bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700'
              }`}
            >
              <Flag size={18} />
              {todosSetoresConcluidos ? 'Encerrar Turno' : 'Forçar Encerramento do Turno'}
            </button>
          )}
        </div>
      )}

      {/* Modal de justificativa para encerramento forçado do turno */}
      {showEncerrarModal && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-stone-850 border border-stone-800 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-stone-100">Encerrar turno com setores pendentes?</h3>
            <p className="text-xs text-stone-400">
              Ainda há setores sem contagem completa. Informe uma justificativa para encerrar o turno mesmo assim.
            </p>
            <textarea
              rows={3}
              value={justificativaEncerramento}
              onChange={(e) => setJustificativaEncerramento(e.target.value)}
              placeholder="Ex: Loja fechou mais cedo, sem tempo para concluir todos os setores..."
              className="w-full bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl text-stone-200 text-sm focus:outline-none focus:border-rose-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowEncerrarModal(false)}
                className="py-2.5 bg-stone-800 hover:bg-stone-750 text-stone-300 text-sm font-semibold rounded-xl border border-stone-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEncerrarTurno(justificativaEncerramento)}
                disabled={!justificativaEncerramento.trim() || encerrando}
                className="py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-stone-100 text-sm font-semibold rounded-xl"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
