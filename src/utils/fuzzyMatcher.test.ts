import { describe, it, expect } from 'vitest';
import { parseVoiceInput, levenshteinDistance, calculateSimilarity } from './fuzzyMatcher';
import type { Product } from '../components/ProductList';

describe('Fuzzy Matcher Utilities', () => {
  const mockProducts: Product[] = [
    { id_produto: 'p1', nome_produto: 'Pão Francês', unidade_medida: 'unidade' },
    { id_produto: 'p2', nome_produto: 'Pão de Queijo', unidade_medida: 'kg' },
    { id_produto: 'p3', nome_produto: 'Farinha de Trigo', unidade_medida: 'kg' },
  ];

  it('calculates levenshtein distance correctly', () => {
    expect(levenshteinDistance('pao', 'pao')).toBe(0);
    expect(levenshteinDistance('pao', 'pão')).toBe(1);
    expect(levenshteinDistance('pao', 'pa')).toBe(1);
  });

  it('calculates similarity correctly', () => {
    expect(calculateSimilarity('Pão Francês', 'pão frances')).toBeGreaterThan(0.8);
    expect(calculateSimilarity('Pão Francês', 'Farinha')).toBeLessThan(0.4);
  });

  it('parses valid numeric inputs correctly', () => {
    const result = parseVoiceInput('pão frances 50', mockProducts);
    expect(result).not.toBeNull();
    expect(result?.productId).toBe('p1');
    expect(result?.quantity).toBe(50);
  });

  it('parses zero inputs correctly with various keywords', () => {
    const keywords = ['zero', 'zerado', 'nenhum', 'nenhuma', 'sem', 'nada'];
    for (const kw of keywords) {
      const result = parseVoiceInput(`pão de queijo ${kw}`, mockProducts);
      expect(result).not.toBeNull();
      expect(result?.productId).toBe('p2');
      expect(result?.quantity).toBe(0);
    }
  });

  it('returns null on low similarity thresholds', () => {
    const result = parseVoiceInput('bolo de cenoura 10', mockProducts);
    expect(result).toBeNull();
  });
});
