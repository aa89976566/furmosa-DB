import { variationLabel } from '@/lib/product-variations';

export type RestockTier = { id: string; weightGrams: number | null; unit: string; unitQty: number };
export type RestockVariantInput = { weightGrams?: number | null; variantKey?: string | null };

/** Never infer one of several variants. Weight alone is accepted only when unique. */
export function resolveRestockVariant(tiers: RestockTier[], input: RestockVariantInput, name = '商品') {
  const weight = input.weightGrams;
  if (weight != null && (!Number.isInteger(weight) || weight <= 0)) throw new Error(`「${name}」規格克數無效，請重新選擇規格。`);
  const key = input.variantKey?.trim();
  if (!tiers.length) {
    if (key || weight != null) throw new Error(`「${name}」沒有此規格，請確認商品主檔。`);
    return { weightGrams: null, variantKey: null, unit: null };
  }
  const matches = key ? tiers.filter(t => t.id === key) : weight != null ? tiers.filter(t => t.weightGrams === weight) : tiers.length === 1 ? tiers : [];
  if (matches.length !== 1) throw new Error(`「${name}」請選擇具體規格，不能自動猜測。`);
  const tier = matches[0];
  if (weight != null && tier.weightGrams !== weight) throw new Error(`「${name}」規格與克數不一致。`);
  return { weightGrams: tier.weightGrams, variantKey: tier.id, unit: tier.unit };
}

export function restockTierLabel(tier: RestockTier) {
  return variationLabel(tier);
}
