import { refillPriceLabel } from '@/lib/refill/constants';

/** Inventory displays retail prices only; costs and commission never leave the server. */
export function inventoryPriceLabel(product: {
  productCategory?: string;
  price?: number | null;
  tiers?: { price?: number | null; status?: string }[];
}): string {
  if (product.productCategory === 'JAR_EXCHANGE') return refillPriceLabel();
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const tiers = product.tiers ?? [];
  const prices = tiers.filter(t => t.status !== 'archived' && valid(t.price)).map(t => t.price as number);
  if (!prices.length && !tiers.length && valid(product.price)) prices.push(product.price);
  if (!prices.length) return '售價待確認';
  const format = (n: number) => n.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
  const min = Math.min(...prices), max = Math.max(...prices);
  return min === max ? `NT$${format(min)}` : `NT$${format(min)}–${format(max)}`;
}
