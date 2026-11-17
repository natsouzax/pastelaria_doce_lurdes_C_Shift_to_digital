/** Limite diário de bolos (personalizados ou não) por dia de levantamento. Acima disto, só contactando a pastelaria. */
export const DAILY_CAKE_LIMIT = 6;
export const CAKE_LIMIT_MESSAGE = 'Cada dia aceita no máximo 6 bolos. Para encomendar mais bolos para o mesmo dia, contacte diretamente a pastelaria.';

/**
 * Quantos bolos uma linha do pedido representa: 0 se não for bolo, 1 por bolo personalizado ou bolo vendido ao kg,
 * e a quantidade (arredondada para cima) para bolos vendidos à unidade.
 * Mantém-se igual ao CASE usado em src/app/api/orders/route.ts.
 */
export function cakeUnits(product: { category: string; is_custom_cake: boolean; unit: string }, quantity: number): number {
  if (product.is_custom_cake) return 1;
  if (!product.category.toLowerCase().includes('bolo')) return 0;
  return product.unit === 'unidade' ? Math.max(1, Math.ceil(quantity)) : 1;
}
