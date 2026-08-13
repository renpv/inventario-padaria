/**
 * Fórmula de sugestão de compra (RF-16), espelhando a função SQL
 * `get_sugestao_compra` usada por `view_dashboard_estoques`:
 *
 *   Qtd Sugerida = (Consumo do Período + Estoque Mínimo)
 *                - (Estoque Atual + Qtd em Pedidos Enviados)
 *
 * Nunca retorna valor negativo (clamp em 0).
 */
export const calculatePurchaseSuggestion = (
  consumoPeriodo: number,
  estoqueMinimo: number,
  estoqueAtual: number,
  qtdPedidosEnviados: number
): number => {
  const sugerido = consumoPeriodo + estoqueMinimo - (estoqueAtual + qtdPedidosEnviados);
  return Math.max(0, sugerido);
};
