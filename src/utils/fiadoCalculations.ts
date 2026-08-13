import { CreditMovement } from '../components/StaffCreditHistory';

export const computeRunningBalances = (movements: CreditMovement[]): (CreditMovement & { saldoApos: number })[] => {
  let runningBalance = 0;
  return movements.map(mov => {
    const isDebit = mov.tipo === 'Adiantamento' || mov.tipo === 'Retirada de produto';
    if (isDebit) {
      runningBalance += Number(mov.valor);
    } else {
      runningBalance -= Number(mov.valor);
    }
    return {
      ...mov,
      saldoApos: runningBalance
    };
  });
};
