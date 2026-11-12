import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { runCatalogAutoCreate, stageAutoCandidates } from '../catalog-auto-create.ts';
import { createCandidateInTransaction } from '../catalog-candidate-create.ts';
import { planShopifyHqCatalogSync, type ShopifyCatalogProduct } from '../catalog-sync.ts';

// Explicit loopback CI database only; never fall back to a runtime/production URL.
let isolated: string | undefined;
try {
  const url = new URL(process.env.INVENTORY_TEST_DATABASE_URL ?? '');
  if (['postgres:', 'postgresql:'].includes(url.protocol) && ['127.0.0.1', 'localhost'].includes(url.hostname) && ['ci', 'inventory_test'].includes(url.pathname.slice(1))) isolated = url.toString();
} catch { /* Missing test database skips this test rather than touching another system. */ }

test('PostgreSQL auto catalog: bounded batches, replay, manual decisions and historical orders', { skip: !isolated }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: isolated! } } });
  const stamp = randomUUID();
  const sourceId = `gid://shopify/Product/${Date.now()}`;
  const variantA = `${Date.now()}01`;
  const variantB = `${Date.now()}02`;
  const source: ShopifyCatalogProduct = { id: sourceId, title: `CI catalog ${stamp}`, status: 'ACTIVE', variants: [
    { id: `gid://shopify/ProductVariant/${variantA}`, title: '1件', sku: `${stamp}-1`, price: 399 },
    { id: `gid://shopify/ProductVariant/${variantB}`, title: '2件', sku: `${stamp}-2`, price: 798 },
  ], content: { description: 'CI isolated clay charm', imageUrl: 'https://cdn.shopify.com/ci-charm.png', productType: '手作黏土吊飾', fields: {
    'furmosa.material_details': '黏土', 'furmosa.dimensions': '8cm', 'furmosa.package_contents': '1件或2件', 'furmosa.play_guide': '掛包包', 'furmosa.cleaning_care': '乾布清潔',
    'custom.hq_catalog_profile': JSON.stringify({ version: 1, autoCreate: true, category: 'accessories', variants: {
      [variantA]: { mode: 'unit', cost: 300, unit: '件', unitQty: 1 }, [variantB]: { mode: 'unit', cost: 600, unit: '件', unitQty: 2 },
    } }),
  } } };
  const baseline = await db.product.create({ data: { productId: stamp, sku: stamp, name: 'CI existing product', price: 50, cost: 25 } });
  const order = await db.order.create({ data: { orderNumber: `CI-${stamp}`, source: 'line', status: 'confirmed', subtotal: 50, total: 50,
    items: { create: { productId: baseline.id, productName: baseline.name, sku: baseline.sku, quantity: 1, unitPrice: 50, subtotal: 50 } },
  }, include: { items: true } });
  const unrelated = await db.shopifyCatalogCandidate.create({ data: { shopifyProductId: `${sourceId}-other`, shopifyVariantId: `${variantA}-other`, productTitle: 'CI unrelated manual item', variantTitle: '1件', price: 1, shopifyStatus: 'ACTIVE', resolution: 'blocked', notes: 'manual decision' } });
  const deps = { domain: () => 'ci-catalog.myshopify.com', stage: stageAutoCandidates, create: createCandidateInTransaction,
    loadAudit: async () => ({ shopifyProducts: [source], hqProducts: [], plan: planShopifyHqCatalogSync([source], []), listingChecks: [], fingerprint: stamp }),
  };
  try {
    const preview = await runCatalogAutoCreate(db, 'inspect', 1, deps);
    assert.equal(preview.rows.length, 1);
    assert.equal(await db.shopifyCatalogCandidate.count({ where: { shopifyProductId: sourceId } }), 0);
    const first = await runCatalogAutoCreate(db, 'create', 1, deps);
    assert.equal(first.rows[0]?.outcome, 'created_draft', JSON.stringify(first.rows));
    const second = await runCatalogAutoCreate(db, 'create', 1, deps);
    assert.equal(second.rows[0]?.outcome, 'created_draft', JSON.stringify(second.rows));
    const replay = await runCatalogAutoCreate(db, 'create', 1, deps);
    assert.equal(replay.examined, 0);
    const products = await db.product.findMany({ where: { name: source.title }, include: { priceTiers: true } });
    assert.equal(products.length, 1);
    assert.equal(products[0]!.status, 'draft');
    assert.equal(products[0]!.priceTiers.length, 2);
    assert.equal(products[0]!.imageUrl, source.content!.imageUrl);
    assert.equal(await db.inventoryTransaction.count({ where: { productId: products[0]!.id } }), 0);
    assert.equal(await db.inventoryBalance.count({ where: { productId: products[0]!.id } }), 0);
    assert.deepEqual(await db.order.findUnique({ where: { id: order.id }, include: { items: true } }), order);
    const retained = await db.shopifyCatalogCandidate.findUniqueOrThrow({ where: { id: unrelated.id } });
    assert.equal(retained.resolution, 'blocked');
    assert.equal(retained.notes, 'manual decision');
  } finally {
    // Cleanup is limited to fixtures created by this test in its loopback CI database.
    await db.order.delete({ where: { id: order.id } });
    await db.shopifyCatalogCandidate.deleteMany({ where: { OR: [{ shopifyProductId: sourceId }, { id: unrelated.id }] } });
    await db.product.deleteMany({ where: { OR: [{ id: baseline.id }, { name: source.title }] } });
    await db.$disconnect();
  }
});
