import { canonicalTierSku } from '@/lib/products/canonical-sku';

export type MatchableTier = {
  id: string;
  productId: string;
  sku: string | null;
  shopifyVariantId: string | null;
  shopifySku: string | null;
  status: string;
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
  defaultWholesaleUnitPrice: number | null;
  defaultConsignmentCommissionMode: string | null;
  defaultConsignmentCommissionValue: number | null;
};

export type TierCatalogProduct = {
  id: string;
  sku: string;
  sourceSku: string | null;
  name: string;
  unit: string;
  businessTier?: string | null;
  priceTiers: MatchableTier[];
};

export type ShopifyLineIdentity = {
  variant_id?: unknown;
  sku?: string | null;
  title?: string | null;
};

export type TierMatch =
  | { outcome: 'match'; reason: 'variant_id' | 'sku' | 'title_alias'; tier: MatchableTier; productId: string }
  | {
      outcome: 'review';
      reason: 'missing' | 'duplicate' | 'inactive' | 'other_product' | 'blank' | 'ambiguous' | 'unbound';
    };

export type TierReviewIssue = {
  code: 'SKU_MISSING' | 'PRODUCT_UNMAPPED';
  severity: 'blocking';
  message: string;
};

export type ClassifiedShopifyLines =
  | { status: 'resolved'; matches: Array<Extract<TierMatch, { outcome: 'match' }>>; issues: [] }
  | { status: 'review'; matches: []; issues: TierReviewIssue[] };

export type ResolvedTierCommercial = {
  commercialRuleSource: 'merchant_exception' | 'product_default';
  defaultCommercialMode: 'percent' | 'amount' | 'fixed_price';
  defaultCommercialValue: number;
  appliedCommercialMode: 'percent' | 'amount' | 'fixed_price';
  appliedCommercialValue: number;
};

/** Trim then case-fold. Hyphens stay, so FD-01 and FD01 are different. */
export function foldSku(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const folded = value.trim().toLowerCase();
  return folded || null;
}

/** Shopify ids stay strings. A non-safe number is present but not an exact id. */
export function readShopifyVariantId(value: unknown): { present: boolean; id: string | null } {
  if (value == null) return { present: false, id: null };
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return { present: true, id: null };
    return { present: true, id: String(value) };
  }
  if (typeof value !== 'string') return { present: true, id: null };
  const text = value.trim();
  if (!text) return { present: false, id: null };
  const digits = text.startsWith('gid://') ? (text.split('/').pop() ?? '') : text;
  if (/^\d+$/.test(digits) && /[1-9]/.test(digits)) return { present: true, id: digits };
  return { present: true, id: null };
}

function isActive(tier: MatchableTier) {
  return tier.status === 'active';
}

function remember(tier: MatchableTier, hits: MatchableTier[], seen: Set<string>) {
  const key = tier.id || `${tier.productId}:${tier.sku ?? ''}:${tier.shopifySku ?? ''}:${tier.weightGrams ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  hits.push(tier);
}

function skuHits(lineSku: string | null | undefined, products: TierCatalogProduct[]) {
  const folded = foldSku(lineSku);
  if (!folded) return [];
  const hits: MatchableTier[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    const active = product.priceTiers.filter(isActive);
    for (const tier of active) {
      const canonical = canonicalTierSku(product.sourceSku, tier, active.length);
      if (
        foldSku(tier.sku) === folded ||
        foldSku(tier.shopifySku) === folded ||
        foldSku(canonical) === folded
      ) remember(tier, hits, seen);
    }
    if (active.length === 1 && (foldSku(product.sku) === folded || foldSku(product.sourceSku) === folded)) {
      remember(active[0]!, hits, seen);
    }
  }
  return hits;
}

function foldProductTitle(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const folded = value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, '');
  return folded || null;
}

/**
 * Explicit business aliases only. This is intentionally not fuzzy name matching.
 * Shopify's current chicken-fillet title is the original CK-05 product.
 */
const SHOPIFY_TITLE_SOURCE_SKU_ALIASES: Record<string, string> = {
  嚎大大雞霸: 'CK-05',
  壕大大雞霸: 'CK-05',
  豪大大雞霸: 'CK-05',
};

function titleAliasHits(title: string | null | undefined, products: TierCatalogProduct[]) {
  const folded = foldProductTitle(title);
  const sourceSku = folded ? SHOPIFY_TITLE_SOURCE_SKU_ALIASES[folded] : undefined;
  if (!sourceSku) return [];
  const hits: MatchableTier[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    if (foldSku(product.sourceSku) !== foldSku(sourceSku)) continue;
    const active = product.priceTiers.filter(isActive);
    if (active.length === 1) remember(active[0]!, hits, seen);
  }
  return hits;
}

function aliasFallback(line: ShopifyLineIdentity, products: TierCatalogProduct[]): TierMatch | null {
  const hits = titleAliasHits(line.title, products);
  if (hits.length === 1) {
    return { outcome: 'match', reason: 'title_alias', tier: hits[0]!, productId: hits[0]!.productId };
  }
  if (hits.length > 1) return { outcome: 'review', reason: 'ambiguous' };
  return null;
}

export function matchShopifyLineToTier(line: ShopifyLineIdentity, products: TierCatalogProduct[]): TierMatch {
  const variant = readShopifyVariantId(line.variant_id);
  if (variant.present) {
    if (!variant.id) return { outcome: 'review', reason: 'unbound' };
    const bound = products.flatMap((product) => product.priceTiers.filter((tier) => tier.shopifyVariantId === variant.id));
    const active = bound.filter(isActive);
    if (active.length === 1) {
      const skuMatch = skuHits(line.sku, products);
      if (skuMatch.length === 1 && skuMatch[0]!.productId !== active[0]!.productId) {
        return { outcome: 'review', reason: 'other_product' };
      }
      return { outcome: 'match', reason: 'variant_id', tier: active[0]!, productId: active[0]!.productId };
    }
    if (bound.length > 0 && active.length === 0) return { outcome: 'review', reason: 'inactive' };
    if (active.length > 1 || bound.length > 1) return { outcome: 'review', reason: 'duplicate' };

    // Shopify variants can be recreated while keeping the same SKU.
    // If this variant id has never been bound in HQ, allow an exact SKU fallback
    // only when it resolves to exactly one active tier. Ambiguous/blank SKU stays blocked.
    const skuMatch = skuHits(line.sku, products);
    if (skuMatch.length === 1) {
      return { outcome: 'match', reason: 'sku', tier: skuMatch[0]!, productId: skuMatch[0]!.productId };
    }
    if (skuMatch.length > 1) return { outcome: 'review', reason: 'ambiguous' };
    const alias = aliasFallback(line, products);
    return alias ?? { outcome: 'review', reason: 'unbound' };
  }

  const foldedSku = foldSku(line.sku);
  const hits = skuHits(line.sku, products);
  if (hits.length === 1) return { outcome: 'match', reason: 'sku', tier: hits[0]!, productId: hits[0]!.productId };
  if (hits.length > 1) return { outcome: 'review', reason: 'ambiguous' };
  const alias = aliasFallback(line, products);
  if (alias) return alias;
  return { outcome: 'review', reason: foldedSku ? 'missing' : 'blank' };
}

export function classifyShopifyLines(lines: ShopifyLineIdentity[], products: TierCatalogProduct[]): ClassifiedShopifyLines {
  const matches: Array<Extract<TierMatch, { outcome: 'match' }>> = [];
  const issues: TierReviewIssue[] = [];
  lines.forEach((line, index) => {
    const decision = matchShopifyLineToTier(line, products);
    if (decision.outcome === 'match') {
      matches.push(decision);
      return;
    }
    issues.push({
      code: decision.reason === 'blank' ? 'SKU_MISSING' : 'PRODUCT_UNMAPPED',
      severity: 'blocking',
      message: `第 ${index + 1} 項無法唯一對應可販售規格，需人工審核`,
    });
  });
  if (issues.length > 0) return { status: 'review', matches: [], issues };
  return { status: 'resolved', matches, issues: [] };
}

function commercialSnapshot(
  source: ResolvedTierCommercial['commercialRuleSource'],
  mode: ResolvedTierCommercial['defaultCommercialMode'],
  value: number,
): ResolvedTierCommercial {
  return {
    commercialRuleSource: source,
    defaultCommercialMode: mode,
    defaultCommercialValue: value,
    appliedCommercialMode: mode,
    appliedCommercialValue: value,
  };
}

function positiveInteger(value: number | null | undefined) {
  return value != null && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Merchant+tier exception, then the tier's own default.
 * businessTier, including premium, is never used to calculate money.
 * Returns null when no exact term is stored.
 */
export function resolveTierCommercialBasis(input: {
  businessTier?: string | null;
  kind: 'consignment' | 'wholesale';
  tier: Pick<MatchableTier, 'id' | 'defaultConsignmentCommissionMode' | 'defaultConsignmentCommissionValue' | 'defaultWholesaleUnitPrice'>;
  merchantTierException?: { tierId: string; mode: string; value: number } | null;
}): ResolvedTierCommercial | null {
  const exception = input.merchantTierException?.tierId === input.tier.id ? input.merchantTierException : null;
  if (input.kind === 'consignment') {
    const exceptionValue = positiveInteger(exception?.value);
    if (exception && (exception.mode === 'percent' || exception.mode === 'amount') && exceptionValue != null) {
      return commercialSnapshot('merchant_exception', exception.mode, exceptionValue);
    }
    const mode = input.tier.defaultConsignmentCommissionMode;
    const tierValue = positiveInteger(input.tier.defaultConsignmentCommissionValue);
    if ((mode === 'percent' || mode === 'amount') && tierValue != null) {
      return commercialSnapshot('product_default', mode, tierValue);
    }
    return null;
  }
  const exceptionValue = positiveInteger(exception?.value);
  if (exception?.mode === 'fixed_price' && exceptionValue != null) {
    return commercialSnapshot('merchant_exception', 'fixed_price', exceptionValue);
  }
  const wholesale = positiveInteger(input.tier.defaultWholesaleUnitPrice);
  if (wholesale != null) return commercialSnapshot('product_default', 'fixed_price', wholesale);
  return null;
}
