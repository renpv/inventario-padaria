import { describe, it, expect } from 'vitest';
import { computeRunningBalances } from './fiadoCalculations';
import type { CreditMovement } from '../components/StaffCreditHistory';

describe('fiadoCalculations - computeRunningBalances', () => {
  it('should compute running balances correctly for a series of debits and credits', () => {
    const movements: CreditMovement[] = [
      { id_movimento: '1', data: '2026-08-01', tipo: 'Adiantamento', valor: 50, observacao: null },
      { id_movimento: '2', data: '2026-08-02', tipo: 'Retirada de produto', valor: 20.5, observacao: null },
      { id_movimento: '3', data: '2026-08-03', tipo: 'Quitação parcial', valor: 30, observacao: null },
      { id_movimento: '4', data: '2026-08-04', tipo: 'Adiantamento', valor: 10, observacao: null },
      { id_movimento: '5', data: '2026-08-05', tipo: 'Quitação total', valor: 50.5, observacao: null },
    ];

    const result = computeRunningBalances(movements);

    expect(result).toHaveLength(5);
    // mov 1: 50
    expect(result[0].saldoApos).toBe(50);
    // mov 2: 50 + 20.5 = 70.5
    expect(result[1].saldoApos).toBe(70.5);
    // mov 3: 70.5 - 30 = 40.5
    expect(result[2].saldoApos).toBe(40.5);
    // mov 4: 40.5 + 10 = 50.5
    expect(result[3].saldoApos).toBe(50.5);
    // mov 5: 50.5 - 50.5 = 0
    expect(result[4].saldoApos).toBe(0);
  });

  it('should handle empty arrays', () => {
    expect(computeRunningBalances([])).toEqual([]);
  });
});
