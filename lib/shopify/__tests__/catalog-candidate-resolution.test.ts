import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blockCandidateInTransaction,
  candidateResolutionFingerprint,
  CandidateResolutionError,
  exactAvailableClaims,
  formatBlockedCandidateNote,
  linkCandidateInTransaction,
  parseBlockedCandidateNote,
  sourceMatchesCandidate,
  sourceRemainsUnmatched,
} from '../catalog-candidate-resolution';
import { planShopifyHqCatalogSync } from '../catalog-sync';

function fixture() {
  const candidate = {
    id: 'candidate-1', shopifyProductId: 'gid://shopify/Product/1', shopifyVariantId: 'gid://shopify/ProductVariant/1',
    productTitle: '雞肉凍乾', variantTitle: '50g', sku: 'ABC-50', price: 200,
    shopifyStatus: 'ACTIVE', resolution: 'pending', linkedProductId: null, linkedTierId: null,
    notes: null, lastSeenAt: new Date('2026-10-28T10:00:00.000Z'),
  };
  const claim = {
    id: 'tier-1', productId: 'hq-product-1', status: 'active', sku: 'ABC-50', shopifySku: null,
    shopifyVariantId: null, product: { status: 'active' },
  };
  const source = {
    productId: candidate.shopifyProductId, variantId: candidate.shopifyVariantId,
    productTitle: candidate.productTitle, variantTitle: candidate.variantTitle,
    sku: candidate.sku, price: candidate.price, shopifyStatus: candidate.shopifyStatus,
  };
  const calls: Array<{ target: string; data: unknown }> = [];
  const claims = [claim];
  const linkedSiblings: Array<{ linkedProductId: string | null }> = [];
  const tx = {
    shopifyCatalogCandidate: {
      findUnique: async () => candidate,
      findMany: async () => linkedSiblings,
      updateMany: async ({ data }: { data: unknown }) => { calls.push({ target: 'candidate', data }); return { count: 1 }; },
    },
    productPriceTier: {
      findMany: async () => claims,
      updateMany: async ({ data }: { data: unknown }) => { calls.push({ target: 'tier', data }); return { count: 1 }; },
    },
    statusAuditLog: {
      create: async ({ data }: { data: unknown }) => { calls.push({ target: 'audit', data }); return data; },
    },
  };
  const shopDomain = 'furmosa.myshopify.com';
  const fingerprint = candidateResolutionFingerprint({ shopDomain, candidate: candidate as never, claims });
  return { candidate, claim, claims, linkedSiblings, source, tx, calls, shopDomain, fingerprint };
}

test('fingerprint changes when the screen snapshot or HQ claims change', () => {
  const f = fixture();
  const changedCandidate = { ...f.candidate, variantTitle: '100g' };
  const changedClaim = [{ ...f.claim, shopifyVariantId: f.candidate.shopifyVariantId }];
  assert.notEqual(candidateResolutionFingerprint({ shopDomain: f.shopDomain, candidate: changedCandidate as never, claims: f.claims }), f.fingerprint);
  assert.notEqual(candidateResolutionFingerprint({ shopDomain: f.shopDomain, candidate: f.candidate as never, claims: changedClaim }), f.fingerprint);
});

test('live Shopify snapshot must still exactly match the candidate', () => {
  const f = fixture();
  assert.equal(sourceMatchesCandidate(f.candidate as never, f.source), true);
  assert.equal(sourceMatchesCandidate(f.candidate as never, { ...f.source, price: 201 }), false);
});

test('live Shopify variant must remain uniquely unmatched', () => {
  const f = fixture();
  const row = { productId: f.source.productId, variantId: f.source.variantId };
  assert.equal(sourceRemainsUnmatched(f.source, [row]), true);
  assert.equal(sourceRemainsUnmatched(f.source, []), false);
  assert.equal(sourceRemainsUnmatched(f.source, [row, row]), false);
});

test('manual LINK remains reachable for a planner product-claim conflict', () => {
  const shopify = [{
    id: 'shopify-product', title: '多規格商品', status: 'ACTIVE' as const,
    variants: [
      { id: 'variant-a', title: 'A', sku: 'SKU-A', price: 100 },
      { id: 'variant-b', title: 'B', sku: 'SKU-B', price: 200 },
    ],
  }];
  const hq = [
    {
      id: 'product-a', productId: 'PROD-A', name: '商品 A', status: 'active', price: 100, sourceSku: null,
      priceTiers: [{ id: 'tier-a', status: 'active', sku: 'SKU-A', shopifySku: null, shopifyVariantId: null, weightGrams: null, unit: '件', unitQty: 1, price: 100 }],
    },
    {
      id: 'product-b', productId: 'PROD-B', name: '商品 B', status: 'active', price: 200, sourceSku: null,
      priceTiers: [{ id: 'tier-b', status: 'active', sku: 'SKU-B', shopifySku: null, shopifyVariantId: null, weightGrams: null, unit: '件', unitQty: 1, price: 200 }],
    },
  ];
  const plan = planShopifyHqCatalogSync(shopify, hq);
  assert.deepEqual(plan.unmatchedShopifyVariants.map((row) => row.variantId), ['variant-a', 'variant-b']);
  const candidate = {
    ...fixture().candidate,
    shopifyProductId: 'shopify-product', shopifyVariantId: 'variant-a',
    productTitle: '多規格商品', variantTitle: 'A', sku: 'SKU-A', price: 100,
  };
  const claim = { ...fixture().claim, id: 'tier-a', productId: 'product-a', sku: 'SKU-A' };
  const source = { productId: 'shopify-product', variantId: 'variant-a', productTitle: '多規格商品', variantTitle: 'A', sku: 'SKU-A', price: 100, shopifyStatus: 'ACTIVE' };
  assert.equal(sourceRemainsUnmatched(source, plan.unmatchedShopifyVariants), true);
  assert.deepEqual(exactAvailableClaims(candidate as never, [claim]).map((row) => row.id), ['tier-a']);
});

test('only one exact active and unbound claim is linkable', () => {
  const f = fixture();
  assert.deepEqual(exactAvailableClaims(f.candidate as never, f.claims).map((row) => row.id), ['tier-1']);
  assert.equal(exactAvailableClaims(f.candidate as never, [{ ...f.claim, sku: 'OTHER' }]).length, 0);
  assert.equal(exactAvailableClaims(f.candidate as never, [{ ...f.claim, shopifyVariantId: 'other' }]).length, 0);
  assert.equal(exactAvailableClaims(f.candidate as never, [{ ...f.claim, shopifyVariantId: '1' }]).length, 0);
  assert.equal(exactAvailableClaims(f.candidate as never, [{ ...f.claim, shopifySku: 'CONFLICTING-SKU' }]).length, 0);
});

test('link writes only identity, candidate decision and audit', async () => {
  const f = fixture();
  await linkCandidateInTransaction(f.tx as never, {
    candidateId: f.candidate.id, tierId: f.claim.id, expectedFingerprint: f.fingerprint,
    shopDomain: f.shopDomain, source: f.source, actorId: 'admin-1',
  });
  const tierWrite = f.calls.find((row) => row.target === 'tier')!.data as Record<string, unknown>;
  assert.deepEqual(tierWrite, { shopifyVariantId: '1', shopifySku: f.candidate.sku });
  assert.equal('price' in tierWrite, false);
  assert.equal('cost' in tierWrite, false);
  const candidateWrite = f.calls.find((row) => row.target === 'candidate')!.data as Record<string, unknown>;
  assert.equal(candidateWrite.resolution, 'linked');
  assert.equal(candidateWrite.linkedProductId, f.claim.productId);
  assert.equal(f.calls.some((row) => row.target === 'audit'), true);
});

test('stale fingerprint and multiple exact tiers fail before writes', async () => {
  const stale = fixture();
  await assert.rejects(linkCandidateInTransaction(stale.tx as never, {
    candidateId: stale.candidate.id, tierId: stale.claim.id, expectedFingerprint: '0'.repeat(64),
    shopDomain: stale.shopDomain, source: stale.source, actorId: 'admin-1',
  }), (error) => error instanceof CandidateResolutionError && error.code === 'STALE_FINGERPRINT');
  assert.equal(stale.calls.length, 0);

  const duplicate = fixture();
  duplicate.claims.push({ ...duplicate.claim, id: 'tier-2', productId: 'hq-product-2' });
  const duplicateFingerprint = candidateResolutionFingerprint({ shopDomain: duplicate.shopDomain, candidate: duplicate.candidate as never, claims: duplicate.claims });
  await assert.rejects(linkCandidateInTransaction(duplicate.tx as never, {
    candidateId: duplicate.candidate.id, tierId: duplicate.claim.id, expectedFingerprint: duplicateFingerprint,
    shopDomain: duplicate.shopDomain, source: duplicate.source, actorId: 'admin-1',
  }), (error) => error instanceof CandidateResolutionError && error.code === 'MULTIPLE_EXACT_TIERS');
  assert.equal(duplicate.calls.length, 0);
});

test('a linked sibling prevents crossing to another HQ product', async () => {
  const f = fixture();
  f.linkedSiblings.push({ linkedProductId: 'another-product' });
  await assert.rejects(linkCandidateInTransaction(f.tx as never, {
    candidateId: f.candidate.id, tierId: f.claim.id, expectedFingerprint: f.fingerprint,
    shopDomain: f.shopDomain, source: f.source, actorId: 'admin-1',
  }), (error) => error instanceof CandidateResolutionError && error.code === 'PRODUCT_MISMATCH');
  assert.equal(f.calls.length, 0);
});

test('same link retry is an idempotent noop without another write', async () => {
  const f = fixture();
  Object.assign(f.candidate, { resolution: 'linked', linkedProductId: f.claim.productId, linkedTierId: f.claim.id });
  const result = await linkCandidateInTransaction(f.tx as never, {
    candidateId: f.candidate.id, tierId: f.claim.id, expectedFingerprint: f.fingerprint,
    shopDomain: f.shopDomain, source: f.source, actorId: 'admin-1',
  });
  assert.equal(result.noop, true);
  assert.equal(f.calls.length, 0);
});

test('candidate CAS failure stops before audit', async () => {
  const f = fixture();
  f.tx.shopifyCatalogCandidate.updateMany = async ({ data }: { data: unknown }) => {
    f.calls.push({ target: 'candidate', data });
    return { count: 0 };
  };
  await assert.rejects(linkCandidateInTransaction(f.tx as never, {
    candidateId: f.candidate.id, tierId: f.claim.id, expectedFingerprint: f.fingerprint,
    shopDomain: f.shopDomain, source: f.source, actorId: 'admin-1',
  }), (error) => error instanceof CandidateResolutionError && error.code === 'CONCURRENT_MODIFICATION');
  assert.equal(f.calls.some((row) => row.target === 'audit'), false);
});

test('audit failure rejects so the surrounding transaction can roll back', async () => {
  const f = fixture();
  f.tx.statusAuditLog.create = async () => { throw new Error('audit unavailable'); };
  await assert.rejects(linkCandidateInTransaction(f.tx as never, {
    candidateId: f.candidate.id, tierId: f.claim.id, expectedFingerprint: f.fingerprint,
    shopDomain: f.shopDomain, source: f.source, actorId: 'admin-1',
  }), /audit unavailable/);
});

test('do-not-create uses fixed reason, CAS fields and audit without catalog writes', async () => {
  const f = fixture();
  await blockCandidateInTransaction(f.tx as never, {
    candidateId: f.candidate.id, reason: '測試商品', note: '內部測試', expectedFingerprint: f.fingerprint,
    shopDomain: f.shopDomain, source: f.source, actorId: 'admin-1',
  });
  const write = f.calls.find((row) => row.target === 'candidate')!.data as Record<string, unknown>;
  assert.equal(write.resolution, 'blocked');
  assert.equal(write.resolvedById, 'admin-1');
  assert.ok(write.resolvedAt instanceof Date);
  assert.equal(write.notes, '[原因:測試商品] 內部測試');
  assert.equal(f.calls.some((row) => row.target === 'tier'), false);
  assert.deepEqual(parseBlockedCandidateNote(String(write.notes)), { reason: '測試商品', detail: '內部測試' });
  assert.equal(formatBlockedCandidateNote('停售'), '[原因:停售]');
});

test('other do-not-create reason requires an explanation', async () => {
  const f = fixture();
  await assert.rejects(blockCandidateInTransaction(f.tx as never, {
    candidateId: f.candidate.id, reason: '其他', note: '', expectedFingerprint: f.fingerprint,
    shopDomain: f.shopDomain, source: f.source, actorId: 'admin-1',
  }), (error) => error instanceof CandidateResolutionError && error.code === 'BLOCK_NOTE_REQUIRED');
  assert.equal(f.calls.length, 0);
});

test('do-not-create rejects a stale screen and same decision retry is idempotent', async () => {
  const stale = fixture();
  await assert.rejects(blockCandidateInTransaction(stale.tx as never, {
    candidateId: stale.candidate.id, reason: '停售', expectedFingerprint: '0'.repeat(64),
    shopDomain: stale.shopDomain, source: stale.source, actorId: 'admin-1',
  }), (error) => error instanceof CandidateResolutionError && error.code === 'STALE_FINGERPRINT');
  assert.equal(stale.calls.length, 0);

  const retry = fixture();
  Object.assign(retry.candidate, { resolution: 'blocked', notes: '[原因:停售]' });
  const result = await blockCandidateInTransaction(retry.tx as never, {
    candidateId: retry.candidate.id, reason: '停售', expectedFingerprint: retry.fingerprint,
    shopDomain: retry.shopDomain, source: retry.source, actorId: 'admin-1',
  });
  assert.equal(result.noop, true);
  assert.equal(retry.calls.length, 0);
});
