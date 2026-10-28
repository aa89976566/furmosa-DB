import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blockCandidateInTransaction,
  CandidateResolutionError,
  formatBlockedCandidateNote,
  linkCandidateInTransaction,
  parseBlockedCandidateNote,
} from '../catalog-candidate-resolution';

function fixture(overrides: Record<string, unknown> = {}) {
  const candidate = {
    id: 'candidate-1',
    shopifyProductId: 'product-1',
    shopifyVariantId: 'variant-1',
    productTitle: '雞肉凍乾',
    variantTitle: '50g',
    sku: 'FUR-0001',
    resolution: 'pending',
    linkedProductId: null,
    linkedTierId: null,
    notes: null,
    ...overrides,
  };
  const tier: {
    id: string;
    productId: string;
    status: string;
    sku: string | null;
    shopifySku: string | null;
    shopifyVariantId: string | null;
    product: { status: string };
  } = {
    id: 'tier-1',
    productId: 'hq-product-1',
    status: 'active',
    sku: 'FUR-0001',
    shopifySku: null,
    shopifyVariantId: null,
    product: { status: 'active' },
  };
  const calls: Array<{ target: string; data?: unknown }> = [];
  const tx = {
    $queryRaw: async () => [{ pg_advisory_xact_lock: null }],
    shopifyCatalogCandidate: {
      findUnique: async () => candidate,
      updateMany: async ({ data }: { data: unknown }) => {
        calls.push({ target: 'candidate', data });
        return { count: 1 };
      },
    },
    productPriceTier: {
      findUnique: async () => tier,
      findMany: async () => [],
      updateMany: async ({ data }: { data: unknown }) => {
        calls.push({ target: 'tier', data });
        return { count: 1 };
      },
    },
    statusAuditLog: {
      create: async ({ data }: { data: unknown }) => {
        calls.push({ target: 'audit', data });
        return data;
      },
    },
  };
  return { tx, candidate, tier, calls };
}

test('link fills empty Shopify identity and resolves candidate without touching commercial fields', async () => {
  const { tx, calls } = fixture();
  const result = await linkCandidateInTransaction(tx as never, {
    candidateId: 'candidate-1', tierId: 'tier-1', actorId: 'admin-1', notes: null,
  });
  assert.equal(result.noop, false);
  const tierWrite = calls.find((call) => call.target === 'tier')?.data as Record<string, unknown>;
  assert.deepEqual(tierWrite, { shopifyVariantId: 'variant-1', shopifySku: 'FUR-0001' });
  assert.equal('price' in tierWrite, false);
  assert.equal('cost' in tierWrite, false);
  assert.equal('weightGrams' in tierWrite, false);
  const candidateWrite = calls.find((call) => call.target === 'candidate')?.data as Record<string, unknown>;
  assert.equal(candidateWrite.resolution, 'linked');
  assert.equal(candidateWrite.linkedProductId, 'hq-product-1');
  assert.equal(candidateWrite.linkedTierId, 'tier-1');
});

test('link refuses to overwrite a different Shopify SKU', async () => {
  const { tx, tier } = fixture();
  tier.shopifySku = 'OTHER-SKU';
  await assert.rejects(
    linkCandidateInTransaction(tx as never, {
      candidateId: 'candidate-1', tierId: 'tier-1', actorId: 'admin-1',
    }),
    (error) => error instanceof CandidateResolutionError && error.code === 'SKU_MISMATCH',
  );
});

test('same candidate and tier retry is an idempotent noop', async () => {
  const { tx, candidate, calls } = fixture({
    resolution: 'linked', linkedProductId: 'hq-product-1', linkedTierId: 'tier-1',
  });
  Object.assign(candidate, { resolution: 'linked', linkedProductId: 'hq-product-1', linkedTierId: 'tier-1' });
  const result = await linkCandidateInTransaction(tx as never, {
    candidateId: 'candidate-1', tierId: 'tier-1', actorId: 'admin-1',
  });
  assert.equal(result.noop, true);
  assert.equal(calls.length, 0);
});

test('block reason uses a reversible fixed note format', async () => {
  const { tx, calls } = fixture();
  await blockCandidateInTransaction(tx as never, {
    candidateId: 'candidate-1', reason: '贈品', note: '活動限定', actorId: 'admin-1',
  });
  const write = calls.find((call) => call.target === 'candidate')?.data as Record<string, unknown>;
  assert.equal(write.resolution, 'blocked');
  assert.equal(write.notes, '[原因:贈品] 活動限定');
  assert.deepEqual(parseBlockedCandidateNote(String(write.notes)), { reason: '贈品', detail: '活動限定' });
  assert.equal(formatBlockedCandidateNote('測試商品'), '[原因:測試商品]');
});

test('other block reason requires a human explanation', async () => {
  const { tx } = fixture();
  await assert.rejects(
    blockCandidateInTransaction(tx as never, {
      candidateId: 'candidate-1', reason: '其他', note: '', actorId: 'admin-1',
    }),
    (error) => error instanceof CandidateResolutionError && error.code === 'BLOCK_NOTE_REQUIRED',
  );
});

test('a concurrent candidate change stops the transaction before audit creation', async () => {
  const { tx, calls } = fixture();
  tx.shopifyCatalogCandidate.updateMany = async () => ({ count: 0 });
  await assert.rejects(
    linkCandidateInTransaction(tx as never, {
      candidateId: 'candidate-1', tierId: 'tier-1', actorId: 'admin-1',
    }),
    (error) => error instanceof CandidateResolutionError && error.code === 'CONCURRENT_MODIFICATION',
  );
  assert.equal(calls.some((call) => call.target === 'audit'), false);
});
