import { z } from 'zod';
import { TIER_UNIT_PRESETS } from '../product-units';
import { checkListingRules } from './listing-rules';
import type { ShopifyCatalogProduct } from './catalog-sync';

export const HQ_CATALOG_PROFILE_KEY = 'custom.hq_catalog_profile';
const positiveInt = z.number().int().positive().max(1_000_000);
const unitSpec = z.object({ mode: z.literal('unit'), cost: z.number().finite().positive(), unit: z.enum(TIER_UNIT_PRESETS), unitQty: positiveInt }).strict();
const weightSpec = z.object({ mode: z.literal('weight'), cost: z.number().finite().positive(), weightGrams: positiveInt }).strict();
const profileSchema = z.object({
  version: z.literal(1), autoCreate: z.literal(true),
  category: z.enum(['staple_food', 'treats', 'health', 'freeze_dried', 'toys', 'accessories', 'other']),
  variants: z.record(z.string().regex(/^[1-9]\d*$/), z.discriminatedUnion('mode', [unitSpec, weightSpec])),
}).strict();

export function catalogAutoCreateProfile(product: ShopifyCatalogProduct, catalog: ShopifyCatalogProduct[]) {
  const raw = product.content?.fields[HQ_CATALOG_PROFILE_KEY];
  if (!raw) return { ok: false as const, code: 'PROFILE_REQUIRED' };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { ok: false as const, code: 'PROFILE_INVALID' }; }
  const parsed = profileSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, code: 'PROFILE_INVALID' };
  if (product.status !== 'ACTIVE') return { ok: false as const, code: 'SOURCE_NOT_ACTIVE' };
  if (checkListingRules(product, catalog).issues.length) return { ok: false as const, code: 'LISTING_INCOMPLETE' };
  const variantIds = product.variants.map(row => row.id.split('/').pop()!);
  if (variantIds.length !== Object.keys(parsed.data.variants).length || variantIds.some(id => !parsed.data.variants[id])) {
    return { ok: false as const, code: 'VARIANT_PROFILE_MISMATCH' };
  }
  const seen = new Set<string>();
  for (const spec of Object.values(parsed.data.variants)) {
    const key = spec.mode === 'weight' ? `weight:${spec.weightGrams}` : `unit:${spec.unit}:${spec.unitQty}`;
    if (seen.has(key)) return { ok: false as const, code: 'DUPLICATE_PACKAGE_SPEC' };
    seen.add(key);
  }
  return { ok: true as const, profile: parsed.data };
}
