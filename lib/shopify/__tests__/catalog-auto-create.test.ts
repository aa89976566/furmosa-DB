import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { runCatalogAutoCreate } from '../catalog-auto-create.ts';
import { planShopifyHqCatalogSync } from '../catalog-sync.ts';
import type { ShopifyCatalogProduct } from '../catalog-sync.ts';

const product: ShopifyCatalogProduct = { id: '1', title: '雞霸吊飾', status: 'ACTIVE', variants: [{ id: 'gid://shopify/ProductVariant/2', title: '1件', sku: 'AC-01', price: 399 }], content: {
  description: '黏土吊飾', imageUrl: 'https://cdn.shopify.com/charm.png', productType: '手作黏土吊飾', fields: {
    'furmosa.material_details': '黏土', 'furmosa.dimensions': '8cm', 'furmosa.package_contents': '1件', 'furmosa.play_guide': '掛包包', 'furmosa.cleaning_care': '乾布清潔',
    'custom.hq_catalog_profile': JSON.stringify({ version: 1, autoCreate: true, category: 'accessories', variants: { '2': { mode: 'unit', cost: 300, unit: '件', unitQty: 1 } } }),
  },
} };

function harness(existing: Array<{ id: string; name: string }> = [], bound = false) {
  const audit = { shopifyProducts: [product], hqProducts: [], plan: planShopifyHqCatalogSync([product], []), listingChecks: [], fingerprint: 'f' };
  const writes: Array<{ kind: string; input: unknown }> = [];
  const candidate = { id: 'c', shopifyProductId: '1', shopifyVariantId: product.variants[0]!.id, productTitle: product.title,
    variantTitle: '1件', sku: 'AC-01', price: 399, shopifyStatus: 'ACTIVE', resolution: 'pending', lastSeenAt: new Date('2026-11-10') };
  const db = {
    product: { findMany: async () => existing, update: async (input: unknown) => { writes.push({ kind: 'content', input }); } },
    shopifyCatalogCandidate: {
      findMany: async (input: { select?: unknown }) => input.select ? (bound ? [{ shopifyProductId: '1', linkedProductId: existing[0]?.id }] : []) : [candidate],
      findUniqueOrThrow: async () => candidate,
    },
    productPriceTier: { findMany: async () => [] },
    statusAuditLog: { create: async (input: unknown) => { writes.push({ kind: 'audit', input }); } },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  const deps = { loadAudit: async () => audit, domain: () => 'store.myshopify.com',
    stage: async (_tx: unknown, input: unknown) => { writes.push({ kind: 'stage', input }); return { runId: '00000000-0000-0000-0000-000000000001' as const, candidateCount: 1, closedCount: 0, reopenedCount: 0 }; },
    create: async (_tx: unknown, input: unknown) => { writes.push({ kind: 'create', input }); return { ok: true as const, noop: false as const, productId: 'hq1', tierId: 'tier1', createdProduct: true }; },
  };
  return { db: db as unknown as PrismaClient, deps, writes };
}
test('inspect is strictly read-only and reports an eligible variant', async () => {
  const h = harness();
  const result = await runCatalogAutoCreate(h.db, 'inspect', 2, h.deps);
  assert.equal(result.rows[0]?.outcome, 'eligible');
  assert.deepEqual(h.writes, []);
});
test('create reuses guarded candidate creation and only writes public content alongside it', async () => {
  const h = harness();
  const result = await runCatalogAutoCreate(h.db, 'create', 2, h.deps);
  assert.equal(result.rows[0]?.outcome, 'created_draft');
  const creation = h.writes.find(row => row.kind === 'create')!.input as Record<string, unknown>;
  assert.equal(creation.cost, 300);
  assert.equal(creation.unit, '件');
  assert.equal('quantity' in creation, false);
  const content = h.writes.find(row => row.kind === 'content')!.input as { data: object };
  assert.deepEqual(Object.keys(content.data).sort(), ['description', 'imageUrl']);
});
test('an unbound same-name HQ product requires manual resolution instead of duplicate creation', async () => {
  const h = harness([{ id: 'hq1', name: product.title }]);
  const result = await runCatalogAutoCreate(h.db, 'inspect', 2, h.deps);
  assert.deepEqual(result.rows, []);
  assert.deepEqual(h.writes, []);
});
test('a parent created by an earlier bounded batch permits remaining variants on later polls', async () => {
  const h = harness([{ id: 'hq1', name: product.title }], true);
  const result = await runCatalogAutoCreate(h.db, 'inspect', 2, h.deps);
  assert.equal(result.rows[0]?.outcome, 'eligible');
});
test('invalid batch size fails before reading or writing', async () => {
  const h = harness();
  await assert.rejects(runCatalogAutoCreate(h.db, 'create', 26, h.deps), /BATCH_LIMIT/);
  assert.deepEqual(h.writes, []);
});
