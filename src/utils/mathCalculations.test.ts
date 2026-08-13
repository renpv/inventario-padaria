import { describe, it, expect } from 'vitest';

export const calculatePurchaseSuggestion = (
  consumo: number,
  minimo: number,
  estoqueAtual: number,
  pedidosEnviados: number
): number => {
  const sugerido = (consumo + minimo) - (estoqueAtual + pedidosEnviados);
  return Math.max(0, sugerido);
};

describe('WMS Purchase Suggestion Formula bounds', () => {
  it('calculates suggested purchase quantity correctly under normal parameters', () => {
    // (Consumo: 100 + Minimo: 20) - (Estoque: 10 + Enviados: 30) = 80
    expect(calculatePurchaseSuggestion(100, 20, 10, 30)).toBe(80);
  });

  it('ensures suggestions bound at 0 when stock exceeds requirements', () => {
    // (Consumo: 10 + Minimo: 5) - (Estoque: 20 + Enviados: 0) = -5 -> should bound at 0
    expect(calculatePurchaseSuggestion(10, 5, 20, 0)).toBe(0);
  });

  it('bounds at 0 when pending orders satisfy the requirements', () => {
    // (Consumo: 20 + Minimo: 10) - (Estoque: 5 + Enviados: 30) = -5 -> should bound at 0
    expect(calculatePurchaseSuggestion(20, 10, 5, 30)).toBe(0);
  });
});
