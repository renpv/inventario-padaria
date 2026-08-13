import { describe, it, expect } from 'vitest';
import { buildTurnosDoDia, getOperationalDayRangeISO } from './operationalDay';
import type { LancamentoRow } from './operationalDay';

const turnos = [
  { id_turno: 't1', nome_turno: 'Manhã - entrada', ordem: 1 },
  { id_turno: 't2', nome_turno: 'Manhã - saída', ordem: 2 },
  { id_turno: 't3', nome_turno: 'Tarde - entrada', ordem: 3 },
  { id_turno: 't4', nome_turno: 'Tarde - saída', ordem: 4 },
];

const lancamento = (id_turno: string, status: LancamentoRow['status'], id_lancamento = `l-${id_turno}`): LancamentoRow => ({
  id_lancamento,
  id_turno,
  status,
});

describe('buildTurnosDoDia', () => {
  it('marks every turno as NÃO INICIADO and unlocked when there are no lançamentos today', () => {
    const result = buildTurnosDoDia(turnos, []);

    expect(result).toHaveLength(4);
    for (const t of result) {
      expect(t.status).toBe('NÃO INICIADO');
      expect(t.bloqueado).toBe(false);
      expect(t.id_lancamento).toBeNull();
    }
  });

  it('sorts turnos by ordem regardless of input array order', () => {
    const shuffled = [turnos[2], turnos[0], turnos[3], turnos[1]];
    const result = buildTurnosDoDia(shuffled, []);

    expect(result.map((t) => t.id_turno)).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('blocks every turno after one that is EM ANDAMENTO (RF-02)', () => {
    const result = buildTurnosDoDia(turnos, [lancamento('t1', 'EM ANDAMENTO')]);

    expect(result[0]).toMatchObject({ id_turno: 't1', status: 'EM ANDAMENTO', bloqueado: false });
    expect(result[1]).toMatchObject({ id_turno: 't2', status: 'NÃO INICIADO', bloqueado: true });
    expect(result[2]).toMatchObject({ id_turno: 't3', status: 'NÃO INICIADO', bloqueado: true });
    expect(result[3]).toMatchObject({ id_turno: 't4', status: 'NÃO INICIADO', bloqueado: true });
  });

  it('does not block the next turno when the previous one is CONFIRMADO', () => {
    const result = buildTurnosDoDia(turnos, [lancamento('t1', 'CONFIRMADO')]);

    expect(result[0]).toMatchObject({ status: 'CONFIRMADO', bloqueado: false });
    expect(result[1]).toMatchObject({ status: 'NÃO INICIADO', bloqueado: false });
  });

  it('does not block the next turno when the previous one is NÃO REALIZADO (self-healing, RF-08)', () => {
    const result = buildTurnosDoDia(turnos, [lancamento('t1', 'NÃO REALIZADO')]);

    expect(result[0]).toMatchObject({ status: 'NÃO REALIZADO', bloqueado: false });
    expect(result[1]).toMatchObject({ status: 'NÃO INICIADO', bloqueado: false });
  });

  it('only propagates the block from the nearest EM ANDAMENTO turno, not past ones that already resolved', () => {
    // t1 já foi resolvido (NÃO REALIZADO), t2 está em andamento -> bloqueia t3 e t4, mas não t1.
    const result = buildTurnosDoDia(turnos, [lancamento('t1', 'NÃO REALIZADO'), lancamento('t2', 'EM ANDAMENTO')]);

    expect(result[0]).toMatchObject({ id_turno: 't1', bloqueado: false });
    expect(result[1]).toMatchObject({ id_turno: 't2', status: 'EM ANDAMENTO', bloqueado: false });
    expect(result[2]).toMatchObject({ id_turno: 't3', bloqueado: true });
    expect(result[3]).toMatchObject({ id_turno: 't4', bloqueado: true });
  });

  it('attaches id_lancamento only for turnos with a matching lançamento today', () => {
    const result = buildTurnosDoDia(turnos, [lancamento('t2', 'CONFIRMADO', 'lanc-abc')]);

    expect(result[0].id_lancamento).toBeNull();
    expect(result[1].id_lancamento).toBe('lanc-abc');
    expect(result[2].id_lancamento).toBeNull();
  });

  it('ignores lançamentos for turnos that are not in the active turnos list', () => {
    const result = buildTurnosDoDia(turnos, [lancamento('turno-inexistente', 'EM ANDAMENTO')]);

    expect(result).toHaveLength(4);
    expect(result.every((t) => t.status === 'NÃO INICIADO' && !t.bloqueado)).toBe(true);
  });

  it('keeps the first lançamento found per turno when duplicates exist (legacy data)', () => {
    // Nota: o comentário de buildTurnosDoDia (operationalDay.ts) diz que
    // duplicatas priorizam "o mais avançado no ciclo de vida", mas a
    // implementação atual apenas mantém o primeiro lançamento encontrado na
    // ordem em que a query os retornou — não há comparação de status entre
    // os duplicados. Este teste documenta o comportamento real; se a query
    // não garantir uma ordem estável (ex.: sem ORDER BY explícito), qual
    // status "vence" entre duplicatas é não-determinístico.
    const result = buildTurnosDoDia(turnos, [
      lancamento('t1', 'CONFIRMADO', 'primeiro'),
      lancamento('t1', 'EM ANDAMENTO', 'segundo'),
    ]);

    expect(result[0]).toMatchObject({ status: 'CONFIRMADO', id_lancamento: 'primeiro' });
  });

  it('returns an empty array when there are no active turnos', () => {
    expect(buildTurnosDoDia([], [])).toEqual([]);
  });
});

describe('getOperationalDayRangeISO', () => {
  it('returns a 24h UTC range starting at midnight of the given date', () => {
    const { startISO, endISO } = getOperationalDayRangeISO(new Date('2026-08-13T14:30:00Z'));

    expect(startISO).toBe('2026-08-13T00:00:00.000Z');
    expect(endISO).toBe('2026-08-14T00:00:00.000Z');
  });

  it('rolls over correctly at a month boundary', () => {
    const { startISO, endISO } = getOperationalDayRangeISO(new Date('2026-08-31T23:59:59Z'));

    expect(startISO).toBe('2026-08-31T00:00:00.000Z');
    expect(endISO).toBe('2026-09-01T00:00:00.000Z');
  });

  it('defaults to the current date when none is provided', () => {
    const { startISO, endISO } = getOperationalDayRangeISO();
    const now = new Date();

    expect(new Date(startISO).getUTCDate()).toBe(now.getUTCDate());
    expect(new Date(endISO).getTime() - new Date(startISO).getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
