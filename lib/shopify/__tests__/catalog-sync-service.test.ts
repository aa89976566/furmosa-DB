import assert from 'node:assert/strict';
import test from 'node:test';
import type { CatalogSyncPlan } from '../catalog-sync.ts';
import {
  SHOPIFY_CANDIDATE_NO_SKU_NOTE,
  SHOPIFY_CANDIDATE_STALE_NOTE_PREFIX,
  stageUnmatchedCatalog,
} from '../catalog-sync-service.ts';

type Candidate = {
  id: string;
  shopifyVariantId: string;
  resolution: string;
  notes: string | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  productTitle?: string;
  variantTitle?: string;
  sku?: string | null;
  price?: number;
  shopifyStatus?: string;
};

function plan(variantIds: string[], blankVariantIds: string[] = []): CatalogSyncPlan {
  return {
    tierUpdates: [],
    productUpdates: [],
    tierArchives: [],
    unmatchedShopifyVariants: variantIds.map((variantId) => ({
      productId: `product-${variantId}`,
      productTitle: `Product ${variantId}`,
      productStatus: 'ACTIVE',
      variantId,
      variantTitle: `Variant ${variantId}`,
      sku: `SKU-${variantId}`,
      price: 100,
    })),
    conflicts: [],
    blankShopifyVariants: blankVariantIds.map((variantId) => ({
      productId: `product-${variantId}`,
      productTitle: `Product ${variantId}`,
      productStatus: 'ACTIVE',
      variantId,
      variantTitle: `Variant ${variantId}`,
      price: 100,
    })),
    unmatchedHqTiers: [],
    ignoredBlankShopifySkus: blankVariantIds.length,
  };
}

function fakeTx(initial: Candidate[]) {
  const candidates = initial.map((row) => ({ ...row }));
  const matches = (row: Candidate, where: Record<string, any>): boolean => {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.resolution !== undefined && row.resolution !== where.resolution) return false;
    if (where.shopifyVariantId?.in && !where.shopifyVariantId.in.includes(row.shopifyVariantId)) return false;
    if (where.shopifyVariantId?.notIn && where.shopifyVariantId.notIn.includes(row.shopifyVariantId)) return false;
    if (where.OR) {
      const noteMatch = where.OR.some((condition: Record<string, any>) => {
        if (typeof condition.notes === 'string') return row.notes === condition.notes;
        if (condition.notes?.startsWith) return row.notes?.startsWith(condition.notes.startsWith) ?? false;
        return false;
      });
      if (!noteMatch) return false;
    }
    return true;
  };
  const tx = {
    shopifyCatalogCandidate: {
      async upsert(args: Record<string, any>) {
        const existing = candidates.find((row) => row.shopifyVariantId === args.where.shopifyVariantId);
        if (existing) Object.assign(existing, args.update);
        else candidates.push({
          id: `candidate-${args.create.shopifyVariantId}`,
          resolution: 'pending', notes: null, resolvedAt: null, resolvedById: null,
          ...args.create,
        });
      },
      async findMany(args: Record<string, any>) {
        return candidates.filter((row) => matches(row, args.where)).map(({ id, notes }) => ({ id, notes }));
      },
      async updateMany(args: Record<string, any>) {
        let count = 0;
        for (const row of candidates) {
          if (!matches(row, args.where)) continue;
          Object.assign(row, args.data);
          count += 1;
        }
        return { count };
      },
    },
    statusAuditLog: { async create() { return {}; } },
  };
  return { tx, candidates };
}

function candidate(index: number, overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: `candidate-${index}`,
    shopifyVariantId: `v${index}`,
    resolution: 'pending',
    notes: null,
    resolvedAt: null,
    resolvedById: null,
    ...overrides,
  };
}

test('reconciles 83 pending candidates to the current 61 without deleting history', async () => {
  const { tx, candidates } = fakeTx(Array.from({ length: 83 }, (_, index) => candidate(index + 1)));
  const currentIds = Array.from({ length: 61 }, (_, index) => `v${index + 1}`);

  const first = await stageUnmatchedCatalog(tx as any, {
    plan: plan(currentIds), fingerprint: 'fingerprint', actorId: 'admin-1',
  });

  assert.equal(first.candidateCount, 61);
  assert.equal(first.closedCount, 22);
  assert.equal(candidates.length, 83);
  assert.equal(candidates.filter((row) => row.resolution === 'pending').length, 61);
  assert.equal(candidates.filter((row) => row.resolution === 'unavailable').length, 22);
  assert.ok(candidates.slice(61).every((row) => row.notes === SHOPIFY_CANDIDATE_STALE_NOTE_PREFIX));
  assert.ok(candidates.slice(61).every((row) => row.resolvedById === null));

  const second = await stageUnmatchedCatalog(tx as any, {
    plan: plan(currentIds), fingerprint: 'fingerprint', actorId: 'admin-1',
  });
  assert.equal(second.closedCount, 0);
  assert.equal(second.reopenedCount, 0);
  assert.equal(candidates.length, 83);
});

test('only reopens system-resolved candidates and preserves manual decisions', async () => {
  const { tx, candidates } = fakeTx([
    candidate(1, { resolution: 'unavailable', notes: `${SHOPIFY_CANDIDATE_STALE_NOTE_PREFIX}\n保留原備註`, resolvedAt: new Date(), resolvedById: null }),
    candidate(2, { resolution: 'unavailable', notes: SHOPIFY_CANDIDATE_NO_SKU_NOTE, resolvedAt: new Date(), resolvedById: null }),
    candidate(3, { resolution: 'unavailable', notes: '人工決定停售', resolvedAt: new Date(), resolvedById: 'admin-2' }),
    candidate(4, { resolution: 'linked', notes: '人工已連結', resolvedAt: new Date(), resolvedById: 'admin-2' }),
    candidate(5, { resolution: 'blocked', notes: '人工阻擋', resolvedAt: new Date(), resolvedById: 'admin-2' }),
  ]);

  const result = await stageUnmatchedCatalog(tx as any, {
    plan: plan(['v1', 'v2', 'v3', 'v4', 'v5']), fingerprint: 'fingerprint', actorId: 'admin-1',
  });

  assert.equal(result.reopenedCount, 2);
  assert.equal(candidates[0]?.resolvedAt, null);
  assert.equal(candidates[1]?.resolvedAt, null);
  assert.deepEqual(
    candidates.map(({ resolution, notes, resolvedById }) => ({ resolution, notes, resolvedById })),
    [
      { resolution: 'pending', notes: '保留原備註', resolvedById: null },
      { resolution: 'pending', notes: null, resolvedById: null },
      { resolution: 'unavailable', notes: '人工決定停售', resolvedById: 'admin-2' },
      { resolution: 'linked', notes: '人工已連結', resolvedById: 'admin-2' },
      { resolution: 'blocked', notes: '人工阻擋', resolvedById: 'admin-2' },
    ],
  );
});

test('preserves notes when closing stale pending candidates and protects an empty snapshot', async () => {
  const { tx, candidates } = fakeTx([
    candidate(1, { notes: '營運備註' }),
    candidate(2),
  ]);

  const empty = await stageUnmatchedCatalog(tx as any, {
    plan: plan([]), fingerprint: 'fingerprint', actorId: 'admin-1',
  });
  assert.equal(empty.closedCount, 0);
  assert.ok(candidates.every((row) => row.resolution === 'pending'));

  const result = await stageUnmatchedCatalog(tx as any, {
    plan: plan(['v2']), fingerprint: 'fingerprint', actorId: 'admin-1',
  });
  assert.equal(result.closedCount, 1);
  assert.equal(candidates[0]?.resolution, 'unavailable');
  assert.equal(candidates[0]?.notes, `${SHOPIFY_CANDIDATE_STALE_NOTE_PREFIX}\n營運備註`);
  assert.equal(candidates[0]?.resolvedById, null);
});

test('marks current blank-SKU variants unavailable without stale-prefixing them', async () => {
  const { tx, candidates } = fakeTx([candidate(1), candidate(2)]);
  const result = await stageUnmatchedCatalog(tx as any, {
    plan: plan(['v1'], ['v2']), fingerprint: 'fingerprint', actorId: 'admin-1',
  });

  assert.equal(result.closedCount, 0);
  assert.equal(candidates[1]?.resolution, 'unavailable');
  assert.equal(candidates[1]?.notes, SHOPIFY_CANDIDATE_NO_SKU_NOTE);
  assert.equal(candidates[1]?.resolvedById, null);
});
