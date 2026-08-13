import type { Product } from '../components/ProductList';

export const levenshteinDistance = (a: string, b: string): number => {
  const tmp = [];
  let i, j;
  const alen = a.length;
  const blen = b.length;

  if (alen === 0) return blen;
  if (blen === 0) return alen;

  for (i = 0; i <= alen; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= blen; j++) {
    tmp[0][j] = j;
  }

  for (i = 1; i <= alen; i++) {
    for (j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }

  return tmp[alen][blen];
};

export const calculateSimilarity = (a: string, b: string): number => {
  const distance = levenshteinDistance(a.toLowerCase().trim(), b.toLowerCase().trim());
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
};

const ZERO_KEYWORDS = ['zero', 'zerado', 'nenhum', 'nenhuma', 'sem', 'nada'];

export interface VoiceMatchResult {
  productId: string;
  nomeProduto: string;
  quantity: number;
  similarity: number;
}

export const parseVoiceInput = (
  inputText: string,
  products: Product[],
  threshold = 0.6
): VoiceMatchResult | null => {
  const cleaned = inputText.toLowerCase().trim();
  if (!cleaned) return null;

  // 1. Try to extract quantity
  let quantity = 0;
  let namePart = cleaned;

  // Regex to match a number at the end of the text
  const numRegex = /(\d+(?:[.,]\d+)?)$/;
  const numMatch = cleaned.match(numRegex);

  if (numMatch) {
    const rawNum = numMatch[1].replace(',', '.');
    quantity = parseFloat(rawNum);
    namePart = cleaned.replace(numRegex, '').trim();
  } else {
    // Check if ends with a zero keyword
    for (const keyword of ZERO_KEYWORDS) {
      const keywordRegex = new RegExp(`\\b${keyword}$`);
      if (keywordRegex.test(cleaned)) {
        quantity = 0;
        namePart = cleaned.replace(keywordRegex, '').trim();
        break;
      }
    }
  }

  if (!namePart) return null;

  // 2. Perform fuzzy matching on namePart
  let bestMatch: Product | null = null;
  let bestSimilarity = 0;

  for (const product of products) {
    const similarity = calculateSimilarity(namePart, product.nome_produto);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = product;
    }
  }

  if (bestMatch && bestSimilarity >= threshold) {
    return {
      productId: bestMatch.id_produto,
      nomeProduto: bestMatch.nome_produto,
      quantity,
      similarity: bestSimilarity,
    };
  }

  return null;
};
