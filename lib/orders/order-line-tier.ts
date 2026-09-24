export type OrderLineTier = { id: string };

/**
 * 訂單商品列必須讓畫面顯示的規格和實際送出的 tierId 一致。
 * 未選、舊資料規格已刪除，或商品只有一個規格時，都安全地落到第一個有效規格。
 */
export function resolveOrderLineTierId(
  tiers: OrderLineTier[],
  selectedTierId: string | null | undefined,
): string {
  if (tiers.length === 0) return '';
  const selected = selectedTierId?.trim() ?? '';
  return tiers.some((tier) => tier.id === selected) ? selected : tiers[0].id;
}
