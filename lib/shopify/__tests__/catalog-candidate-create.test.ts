import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  CandidateCreateError,
  createCandidateInTransaction,
  normalizeCandidateCreateInput,
  type CandidateCreateInput,
} from '../catalog-candidate-create';
import { candidateResolutionFingerprint } from '../catalog-candidate-resolution';

const base: CandidateCreateInput = {
  candidateId: 'candidate-1', expectedFingerprint: 'a'.repeat(64), shopDomain: 'furmosa.myshopify.com',
  source: { productId: 'gid://shopify/Product/1', variantId: 'gid://shopify/ProductVariant/2', productTitle: '雞肉凍乾', variantTitle: '50g', sku: 'FD-01', price: 200, shopifyStatus: 'ACTIVE' },
  actorId: 'admin-1', category: 'freeze_dried', mode: 'weight', cost: 80, weightGrams: 50,
};

test('requires a real positive package cost and explicit package specification', () => {
  for (const cost of [0, -1, Number.NaN]) {
    assert.throws(() => normalizeCandidateCreateInput({ ...base, cost }), CandidateCreateError);
  }
  assert.throws(() => normalizeCandidateCreateInput({ ...base, weightGrams: null }), CandidateCreateError);
  assert.deepEqual(normalizeCandidateCreateInput(base), {
    category: 'freeze_dried', mode: 'weight', cost: 80, weightGrams: 50, unit: 'g', unitQty: 1,
  });
});

test('unit mode accepts only controlled units and a positive integer quantity', () => {
  const unit = { ...base, mode: 'unit' as const, unit: '條', unitQty: 3 };
  assert.equal(normalizeCandidateCreateInput(unit).unit, '條');
  assert.throws(() => normalizeCandidateCreateInput({ ...unit, unit: '自訂危險單位' }), CandidateCreateError);
  assert.throws(() => normalizeCandidateCreateInput({ ...unit, unitQty: 0 }), CandidateCreateError);
});

test('service source includes transactional lock, CAS, audit and no inventory writes', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'lib/shopify/catalog-candidate-create.ts'), 'utf8');
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /isolationLevel: 'Serializable'/);
  assert.match(source, /resolution: 'pending'/);
  assert.match(source, /newStatus: 'created'/);
  assert.doesNotMatch(source, /inventoryBalance|inventoryTransaction|purchaseOrder|orderIssue/);
});

function transactionFixture(options?: {
  siblingProductIds?: string[];
  casCount?: number;
  auditFails?: boolean;
  input?: Partial<CandidateCreateInput> & { source?: Partial<CandidateCreateInput['source']> };
  targetProducts?: Array<{ id: string; name: string }>;
}) {
  const fixtureBase = {
    ...base,
    ...options?.input,
    source: { ...base.source, ...options?.input?.source },
  } satisfies CandidateCreateInput;
  const candidate = {
    id: 'candidate-1', shopifyProductId: fixtureBase.source.productId, shopifyVariantId: fixtureBase.source.variantId,
    productTitle: fixtureBase.source.productTitle, variantTitle: fixtureBase.source.variantTitle, sku: fixtureBase.source.sku,
    price: fixtureBase.source.price, shopifyStatus: fixtureBase.source.shopifyStatus, resolution: 'pending',
    linkedProductId: null as string | null, linkedTierId: null as string | null,
    firstSeenAt: new Date('2026-10-28T09:00:00Z'), lastSeenAt: new Date('2026-10-28T10:00:00Z'),
    resolvedAt: null, resolvedById: null, notes: null,
  };
  const calls: Array<{ target: string; data?: Record<string, unknown> }> = [];
  let auditMetadata: string | null = null;
  const tx = {
    $queryRaw: async () => { calls.push({ target: 'lock' }); return [{ pg_advisory_xact_lock: null }]; },
    shopifyCatalogCandidate: {
      findUnique: async () => candidate,
      findMany: async () => (options?.siblingProductIds ?? []).map((linkedProductId) => ({ linkedProductId })),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ target: 'candidate', data });
        return { count: options?.casCount ?? 1 };
      },
    },
    productPriceTier: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ target: 'tier', data });
        return { id: 'tier-created' };
      },
    },
    product: {
      findMany: async (args?: { select?: { name?: boolean } }) => args?.select?.name
        ? (options?.targetProducts ?? [])
        : [{ productId: 'PROD-0009' }],
      findUnique: async () => ({ id: 'existing-product', status: 'active', category: 'treats' }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ target: 'product', data });
        return { id: 'product-created' };
      },
    },
    statusAuditLog: {
      findMany: async () => auditMetadata == null ? [] : [{ metadataJson: auditMetadata }],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (options?.auditFails) throw new Error('audit unavailable');
        auditMetadata = String(data.metadataJson);
        calls.push({ target: 'audit', data });
        return data;
      },
    },
  };
  const input = {
    ...fixtureBase,
    expectedFingerprint: candidateResolutionFingerprint({ shopDomain: fixtureBase.shopDomain, candidate: candidate as never, claims: [] }),
  };
  return { candidate, calls, tx, input, getAuditMetadata: () => auditMetadata };
}

test('first variant writes one draft Product, one Tier, one candidate decision and one audit', async () => {
  const fixture = transactionFixture();
  const result = await createCandidateInTransaction(fixture.tx as never, fixture.input);
  if (result.noop) throw new Error('expected a new create result');
  assert.equal(result.createdProduct, true);
  assert.deepEqual(fixture.calls.map((call) => call.target), ['lock', 'lock', 'product', 'tier', 'candidate', 'audit']);
  const product = fixture.calls.find((call) => call.target === 'product')!.data!;
  assert.equal(product.status, 'draft');
  assert.equal(product.productId, 'PROD-0010');
  assert.equal(product.sku, 'FUR-0010');
  assert.equal(product.cost, 1.6);
  assert.equal(product.reorderPoint, 0);
  const tier = fixture.calls.find((call) => call.target === 'tier')!.data!;
  assert.equal(tier.cost, 80);
  assert.equal(tier.weightGrams, 50);
  assert.equal(tier.status, 'active');
  const decision = fixture.calls.find((call) => call.target === 'candidate')!.data!;
  assert.equal(decision.resolution, 'created');
  assert.equal(fixture.calls.some((call) => /inventory|order|shopify/i.test(call.target)), false);
});

test('a uniquely claimed parent adds only a Tier to the existing Product', async () => {
  const fixture = transactionFixture({ siblingProductIds: ['existing-product'] });
  const result = await createCandidateInTransaction(fixture.tx as never, fixture.input);
  if (result.noop) throw new Error('expected a new create result');
  assert.equal(result.createdProduct, false);
  assert.equal(result.productId, 'existing-product');
  assert.equal(fixture.calls.some((call) => call.target === 'product'), false);
  assert.equal(fixture.calls.find((call) => call.target === 'tier')!.data!.productId, 'existing-product');
  const audit = JSON.parse(String(fixture.calls.find((call) => call.target === 'audit')!.data!.metadataJson));
  assert.equal(audit.category, 'treats');
  assert.equal(audit.categoryApplied, false);
});

test('a unique canonical product-name match adds the Shopify package to the existing HQ product', async () => {
  const fixture = transactionFixture({
    input: {
      source: {
        productId: base.source.productId, variantId: base.source.variantId,
        productTitle: '◈ 走敢若飛 ◈ 鴨翅', variantTitle: '單支', sku: 'CHEW-DUCKWING-1', price: 75,
        shopifyStatus: base.source.shopifyStatus,
      },
      mode: 'unit', weightGrams: null, unit: '隻', unitQty: 1, cost: 23,
      targetProductId: 'existing-product',
    },
    targetProducts: [{ id: 'existing-product', name: '鴨翅' }],
  });
  const result = await createCandidateInTransaction(fixture.tx as never, fixture.input);
  if (result.noop) throw new Error('expected a new create result');
  assert.equal(result.createdProduct, false);
  assert.equal(result.productId, 'existing-product');
  assert.equal(fixture.calls.some((call) => call.target === 'product'), false);
  const audit = JSON.parse(String(fixture.calls.find((call) => call.target === 'audit')!.data!.metadataJson));
  assert.equal(audit.matchedExistingProductByName, true);
});

test('a unique exact Shopify title reuses an HQ product that still has its marketing prefix', async () => {
  const fixture = transactionFixture({
    input: {
      source: {
        productId: base.source.productId, variantId: base.source.variantId,
        productTitle: '◈ 走敢若飛 ◈ 鴨翅', variantTitle: '五支', sku: 'CHEW-DUCKWING-5', price: 385,
        shopifyStatus: base.source.shopifyStatus,
      },
      mode: 'unit', weightGrams: null, unit: '支', unitQty: 5, cost: 115,
      targetProductId: 'existing-product',
    },
    targetProducts: [{ id: 'existing-product', name: '◈ 走敢若飛 ◈ 鴨翅' }],
  });
  const result = await createCandidateInTransaction(fixture.tx as never, fixture.input);
  if (result.noop) throw new Error('expected a new create result');
  assert.equal(result.productId, 'existing-product');
  assert.equal(result.createdProduct, false);
  assert.equal(fixture.calls.some((call) => call.target === 'product'), false);
});

test('name-based target fails closed when the HQ name is no longer unique', async () => {
  const fixture = transactionFixture({
    input: {
      source: {
        productId: base.source.productId, variantId: base.source.variantId,
        productTitle: '◈ 走敢若飛 ◈ 鴨翅', variantTitle: '單支', sku: 'CHEW-DUCKWING-1', price: 75,
        shopifyStatus: base.source.shopifyStatus,
      },
      mode: 'unit', weightGrams: null, unit: '隻', unitQty: 1, cost: 23,
      targetProductId: 'existing-product',
    },
    targetProducts: [
      { id: 'existing-product', name: '鴨翅' },
      { id: 'duplicate-product', name: '鴨翅' },
    ],
  });
  await assert.rejects(createCandidateInTransaction(fixture.tx as never, fixture.input), /不再是唯一一筆/);
  assert.equal(fixture.calls.some((call) => call.target === 'tier'), false);
});

test('unit create stores package cost without inventing a per-item conversion', async () => {
  const fixture = transactionFixture();
  const input = { ...fixture.input, mode: 'unit' as const, weightGrams: null, unit: '條', unitQty: 3 };
  const result = await createCandidateInTransaction(fixture.tx as never, input);
  if (result.noop) throw new Error('expected a new create result');
  const product = fixture.calls.find((call) => call.target === 'product')!.data!;
  const tier = fixture.calls.find((call) => call.target === 'tier')!.data!;
  assert.equal(product.cost, 80);
  assert.equal(product.unit, '條');
  assert.equal(tier.cost, 80);
  assert.equal(tier.unitQty, 3);
});

test('multiple parent claims and candidate CAS failure fail closed before audit', async () => {
  const mismatch = transactionFixture({ siblingProductIds: ['product-a', 'product-b'] });
  await assert.rejects(createCandidateInTransaction(mismatch.tx as never, mismatch.input), /不同 HQ 商品/);
  assert.deepEqual(mismatch.calls.map((call) => call.target), ['lock', 'lock']);

  const cas = transactionFixture({ casCount: 0 });
  await assert.rejects(createCandidateInTransaction(cas.tx as never, cas.input), /其他人處理/);
  assert.equal(cas.calls.some((call) => call.target === 'audit'), false);
});

test('same completed decision replays without writes and changed input is rejected', async () => {
  const fixture = transactionFixture();
  const first = await createCandidateInTransaction(fixture.tx as never, fixture.input);
  fixture.candidate.resolution = 'created';
  fixture.candidate.linkedProductId = first.productId;
  fixture.candidate.linkedTierId = first.tierId;
  const writesBefore = fixture.calls.length;
  const replay = await createCandidateInTransaction(fixture.tx as never, fixture.input);
  assert.equal(replay.noop, true);
  assert.deepEqual(fixture.calls.slice(writesBefore).map((call) => call.target), ['lock', 'lock']);
  await assert.rejects(
    createCandidateInTransaction(fixture.tx as never, { ...fixture.input, cost: 81 }),
    /不同資料建立/,
  );
});

test('audit failure rejects the transaction and never reports success', async () => {
  const fixture = transactionFixture({ auditFails: true });
  await assert.rejects(createCandidateInTransaction(fixture.tx as never, fixture.input), /audit unavailable/);
});
