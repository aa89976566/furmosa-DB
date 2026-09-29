import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyShopifyLines,
  foldSku,
  matchShopifyLineToTier,
  readShopifyVariantId,
  resolveTierCommercialBasis,
  type MatchableTier,
  type TierCatalogProduct,
} from '@/lib/shopify/match-product-tier';

const LARGE_VARIANT = '900719925474099312345';

function tier(overrides: Partial<MatchableTier> = {}): MatchableTier {
  return {
    id: 'tier-1',
    productId: 'product-1',
    sku: 'FD-01',
    shopifyVariantId: null,
    shopifySku: null,
    status: 'active',
    weightGrams: 30,
    unit: '克',
    unitQty: 1,
    price: 84,
    defaultWholesaleUnitPrice: 50,
    defaultConsignmentCommissionMode: 'percent',
    defaultConsignmentCommissionValue: 2000,
    ...overrides,
  };
}

function product(overrides: Partial<TierCatalogProduct> = {}): TierCatalogProduct {
  const row: TierCatalogProduct = {
    id: 'product-1',
    sku: 'HQ-01',
    sourceSku: 'FD-01',
    name: '鴨喉嚨',
    unit: '包',
    businessTier: 'premium',
    priceTiers: [tier()],
    ...overrides,
  };
  row.priceTiers = row.priceTiers.map((entry) => ({ ...entry, productId: row.id }));
  return row;
}

describe('Shopify tier matcher', () => {
  it('keeps variant ids as strings, including values past the safe integer limit', () => {
    assert.deepEqual(readShopifyVariantId(LARGE_VARIANT), { present: true, id: LARGE_VARIANT });
    assert.equal(readShopifyVariantId(LARGE_VARIANT).id, LARGE_VARIANT);
    assert.equal(Number.isSafeInteger(Number(LARGE_VARIANT)), false);
    assert.deepEqual(readShopifyVariantId(Number.MAX_SAFE_INTEGER + 2), { present: true, id: null });
  });

  it('matches one active variant binding and rejects missing, duplicate, inactive, and another product', () => {
    const bound = product({ priceTiers: [tier({ shopifyVariantId: LARGE_VARIANT, sku: 'OTHER' })] });
    assert.equal(matchShopifyLineToTier({ variant_id: LARGE_VARIANT, sku: 'NO-SKU' }, [bound]).outcome, 'match');
    assert.equal(matchShopifyLineToTier({ variant_id: '404', sku: 'FD-01' }, [bound]).reason, 'unbound');
    const duplicate = product({
      priceTiers: [
        tier({ id: 'a', shopifyVariantId: '7' }),
        tier({ id: 'b', shopifyVariantId: '7', weightGrams: 50 }),
      ],
    });
    assert.equal(matchShopifyLineToTier({ variant_id: '7' }, [duplicate]).reason, 'duplicate');
    const inactive = product({ priceTiers: [tier({ shopifyVariantId: '7', status: 'archived' })] });
    assert.equal(matchShopifyLineToTier({ variant_id: '7', sku: 'FD-01' }, [inactive]).reason, 'inactive');
    const other = product({ id: 'product-2', sku: 'HQ-02', sourceSku: 'ZZ-02', priceTiers: [tier({ id: 'other', productId: 'product-2', shopifyVariantId: '7', sku: 'ZZ-02' })] });
    const home = product();
    assert.equal(matchShopifyLineToTier({ variant_id: '7', sku: 'FD-01' }, [home, other]).reason, 'other_product');
  });

  it('does not fall back to SKU when a variant id is present but unbound', () => {
    const decision = matchShopifyLineToTier({ variant_id: LARGE_VARIANT, sku: 'FD-01' }, [product()]);
    assert.equal(decision.outcome, 'review');
    assert.equal(decision.reason, 'unbound');
  });

  it('case-folds a unique SKU only when no variant id exists, and keeps FD-01 distinct from FD01', () => {
    assert.equal(foldSku(' FD-01 '), 'fd-01');
    assert.notEqual(foldSku('FD-01'), foldSku('FD01'));
    const catalog = [product()];
    assert.equal(matchShopifyLineToTier({ sku: ' fd-01 ' }, catalog).outcome, 'match');
    assert.equal(matchShopifyLineToTier({ sku: 'FD01' }, catalog).reason, 'missing');
    assert.equal(matchShopifyLineToTier({ sku: '   ' }, catalog).reason, 'blank');
    const second = product({ id: 'product-2', sku: 'HQ-02', sourceSku: 'FD-01', priceTiers: [tier({ id: 'tier-2', productId: 'product-2' })] });
    assert.equal(matchShopifyLineToTier({ sku: 'FD-01' }, [product(), second]).reason, 'ambiguous');
  });

  it('does not guess a tier for legacy products with zero or many tiers', () => {
    const none = product({ sku: 'LEGACY', sourceSku: 'LEGACY', priceTiers: [] });
    const many = product({
      sku: 'MULTI',
      sourceSku: 'MULTI',
      priceTiers: [tier({ id: 'a', sku: null }), tier({ id: 'b', sku: null, weightGrams: 50 })],
    });
    assert.equal(matchShopifyLineToTier({ sku: 'LEGACY' }, [none]).reason, 'missing');
    assert.equal(matchShopifyLineToTier({ sku: 'MULTI' }, [many]).reason, 'missing');
    const safe = product({ priceTiers: [tier({ sku: null })] });
    assert.equal(matchShopifyLineToTier({ sku: 'FD-01' }, [safe]).outcome, 'match');
  });

  it('keeps a whole order in review when any line is unresolved', () => {
    const classified = classifyShopifyLines(
      [{ sku: 'FD-01' }, { variant_id: '404', sku: 'FD-01' }],
      [product()],
    );
    assert.equal(classified.status, 'review');
    assert.equal(classified.matches.length, 0);
    assert.equal(classified.issues.length, 1);
  });

  it('uses the merchant tier exception, then the tier default, and never premium', () => {
    const row = tier();
    const exception = resolveTierCommercialBasis({
      businessTier: 'premium',
      kind: 'consignment',
      tier: row,
      merchantTierException: { tierId: row.id, mode: 'amount', value: 12 },
    });
    assert.equal(exception?.commercialRuleSource, 'merchant_exception');
    assert.equal(exception?.appliedCommercialValue, 12);
    const fallback = resolveTierCommercialBasis({ businessTier: 'premium', kind: 'consignment', tier: row, merchantTierException: null });
    assert.equal(fallback?.commercialRuleSource, 'product_default');
    assert.equal(fallback?.appliedCommercialValue, 2000);
    const otherTier = resolveTierCommercialBasis({
      businessTier: 'premium',
      kind: 'wholesale',
      tier: row,
      merchantTierException: { tierId: 'someone-else', mode: 'fixed_price', value: 1 },
    });
    assert.equal(otherTier?.appliedCommercialValue, 50);
    const missing = resolveTierCommercialBasis({
      businessTier: 'premium',
      kind: 'consignment',
      tier: tier({ defaultConsignmentCommissionMode: null, defaultConsignmentCommissionValue: null }),
      merchantTierException: null,
    });
    assert.equal(missing, null);
  });
});
