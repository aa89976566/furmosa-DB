import { formatCurrency } from '@/lib/format';
import { computeTierMargin } from '@/lib/product-price-tier';

export type ProductVariation = {
  id: string;
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
  cost: number | null;
  notes: string | null;
};

export function variationLabel(variation: Pick<ProductVariation, 'weightGrams' | 'unit' | 'unitQty'>) {
  if (variation.weightGrams) return `${variation.weightGrams}g`;
  return `${variation.unitQty} ${variation.unit}`;
}

export function formatPriceRange(prices: number[]) {
  if (prices.length === 0) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatCurrency(min);
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

/** 僅依各規格自己的售價與成本計算摘要 */
export function summarizeVariations(variations: ProductVariation[]) {
  if (variations.length === 0) {
    return {
      count: 0,
      priceRange: '—',
      marginRange: '—',
      hasVariations: false,
    };
  }

  const prices = variations.map((variation) => variation.price);
  const margins = variations
    .map((variation) => computeTierMargin(variation))
    .filter((value): value is number => value != null);

  let marginRange = '—';
  if (margins.length > 0) {
    const min = Math.min(...margins);
    const max = Math.max(...margins);
    marginRange =
      min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
  }

  return {
    count: variations.length,
    priceRange: formatPriceRange(prices),
    marginRange,
    hasVariations: true,
  };
}
