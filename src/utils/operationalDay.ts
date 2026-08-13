// Limites do "dia operacional" usados para filtrar lançamentos de turno.
//
// Simplificação conhecida: o PRD (seção 8.6) prevê horários de corte
// configuráveis para que operações feitas de madrugada pertençam ao dia
// correto. Isso não está implementado ainda — hoje o dia operacional é a
// data corrente em UTC (mesmo critério usado nas RPCs `iniciar_turno` e
// `encerrar_turno`, que fazem `data::date` na timezone padrão do Postgres).
export const getOperationalDayRangeISO = (date: Date = new Date()) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

export type TurnoStatus = 'NÃO INICIADO' | 'EM ANDAMENTO' | 'CONFIRMADO' | 'NÃO REALIZADO';

export interface TurnoDoDia {
  id_turno: string;
  nome_turno: string;
  ordem: number;
  id_lancamento: string | null;
  status: TurnoStatus;
}

export interface LancamentoRow {
  id_lancamento: string;
  id_turno: string;
  status: 'EM ANDAMENTO' | 'CONFIRMADO' | 'NÃO REALIZADO';
}

/**
 * Combina a lista de turnos ativos (ordenada por `ordem`) com os lançamentos
 * de hoje (tipo Inventário) para derivar o status de cada turno e se ele
 * está bloqueado para a operação.
 *
 * Bloqueado = existe algum turno anterior (ordem menor) cujo lançamento de
 * hoje está EM ANDAMENTO (começado, mas ainda não encerrado). Turnos
 * anteriores sem nenhum lançamento não bloqueiam: o self-healing da RPC
 * `iniciar_turno` os resolve automaticamente como NÃO REALIZADO no momento
 * em que o turno seguinte é iniciado (RF-08).
 */
export const buildTurnosDoDia = (
  turnos: { id_turno: string; nome_turno: string; ordem: number }[],
  lancamentosHoje: LancamentoRow[]
): (TurnoDoDia & { bloqueado: boolean })[] => {
  const porTurno = new Map<string, LancamentoRow>();
  for (const l of lancamentosHoje) {
    // Em tese só deveria existir um lançamento de Inventário por turno/dia;
    // se houver mais de um (dados legados de antes da correção do Onda 2),
    // priorizamos o mais "avançado" no ciclo de vida.
    const atual = porTurno.get(l.id_turno);
    if (!atual) {
      porTurno.set(l.id_turno, l);
    }
  }

  const ordenados = [...turnos].sort((a, b) => a.ordem - b.ordem);
  const resultado: (TurnoDoDia & { bloqueado: boolean })[] = [];
  let algumAnteriorEmAndamento = false;

  for (const t of ordenados) {
    const lancamento = porTurno.get(t.id_turno);
    const status: TurnoStatus = lancamento ? lancamento.status : 'NÃO INICIADO';

    resultado.push({
      id_turno: t.id_turno,
      nome_turno: t.nome_turno,
      ordem: t.ordem,
      id_lancamento: lancamento ? lancamento.id_lancamento : null,
      status,
      bloqueado: algumAnteriorEmAndamento,
    });

    if (status === 'EM ANDAMENTO') {
      algumAnteriorEmAndamento = true;
    }
  }

  return resultado;
};
