import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const MERCHANT_ID = 'cmtoebi6eefz5xppns';
const NOTE = '[森的汪星 POS 校正 2026-09-30] 依現場盤點建立一般寄賣庫存；換罐商品與原味雞霸贈品不列入可售庫存';
const TARGETS = [
  { sku: 'FUR-0023', weight: 15, price: 108 },
  { sku: 'FUR-0028', weight: 10, price: 125 },
  { sku: 'FUR-0022', weight: 20, price: 130 },
  { sku: 'FUR-0011', weight: 30, price: 114 },
  { sku: 'FUR-0008', weight: 15, price: 42 },
  { sku: 'FUR-0003', weight: 25, price: 130 },
  { sku: 'FUR-0024', weight: 20, price: 104 },
];
const GIFT_SKU = 'FUR-0002';

async function loadPlan(db = prisma) {
  const merchant = await db.merchant.findUnique({
    where: { id: MERCHANT_ID },
    select: { id: true, name: true, merchantId: true },
  });
  if (!merchant || merchant.name !== '森的汪星' || merchant.merchantId !== 'MER-0021') {
    throw new Error('STOP: merchant identity no longer matches 森的汪星 / MER-0021');
  }

  const products = await db.product.findMany({
    where: {
      OR: [
        { sku: { in: [...TARGETS.map((row) => row.sku), GIFT_SKU] } },
        { productCategory: 'JAR_EXCHANGE', merchantStocks: { some: { merchantId: MERCHANT_ID } } },
      ],
    },
    include: {
      priceTiers: true,
      merchantStocks: { where: { merchantId: MERCHANT_ID } },
    },
    orderBy: { sku: 'asc' },
  });

  const desired = [];
  for (const config of TARGETS) {
    const product = products.find((row) => row.sku === config.sku);
    if (!product || product.status !== 'active' || product.productCategory !== 'STANDARD') {
      throw new Error(`STOP: active STANDARD product ${config.sku} not found`);
    }
    const tiers = product.priceTiers.filter(
      (tier) => tier.status === 'active' &&
        tier.weightGrams === config.weight &&
        Number(tier.price) === config.price,
    );
    if (tiers.length !== 1) {
      throw new Error(`STOP: expected one ${config.sku} ${config.weight}g/$${config.price} tier, found ${tiers.length}`);
    }
    desired.push({ product, tier: tiers[0], quantity: 1 });
  }

  const gift = products.find((row) => row.sku === GIFT_SKU);
  if (!gift) throw new Error('STOP: gift product FUR-0002 not found');

  const existingByKey = new Map(
    products.flatMap((product) =>
      product.merchantStocks.map((stock) => [
        `${stock.productId}::${stock.tierId}`,
        { ...stock, product },
      ]),
    ),
  );

  const changes = [];
  for (const target of desired) {
    const key = `${target.product.id}::${target.tier.id}`;
    const row = existingByKey.get(key);
    const before = row?.quantity ?? 0;
    if (before !== 1) {
      changes.push({
        action: row ? 'update' : 'create',
        stockId: row?.id ?? null,
        productId: target.product.id,
        tierId: target.tier.id,
        sku: target.product.sku,
        name: target.product.name,
        before,
        after: 1,
      });
    }
    for (const other of target.product.merchantStocks) {
      if (other.tierId !== target.tier.id && other.quantity !== 0) {
        changes.push({
          action: 'update',
          stockId: other.id,
          productId: target.product.id,
          tierId: other.tierId,
          sku: target.product.sku,
          name: target.product.name,
          before: other.quantity,
          after: 0,
        });
      }
    }
  }

  for (const product of products) {
    if (product.productCategory !== 'JAR_EXCHANGE' && product.sku !== GIFT_SKU) continue;
    for (const stock of product.merchantStocks) {
      if (stock.quantity === 0) continue;
      changes.push({
        action: 'update',
        stockId: stock.id,
        productId: product.id,
        tierId: stock.tierId,
        sku: product.sku,
        name: product.name,
        before: stock.quantity,
        after: 0,
      });
    }
  }

  return { merchant, desired, changes };
}

async function main() {
  const plan = await loadPlan();
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'preflight',
    merchant: plan.merchant,
    desired: plan.desired.map(({ product, tier, quantity }) => ({
      sku: product.sku,
      name: product.name,
      weightGrams: tier.weightGrams,
      price: tier.price,
      quantity,
    })),
    changes: plan.changes,
  }, null, 2));

  if (!apply || plan.changes.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const current = await loadPlan(tx);
    for (const [index, change] of current.changes.entries()) {
      if (change.action === 'create') {
        await tx.merchantStock.create({
          data: {
            merchantId: MERCHANT_ID,
            productId: change.productId,
            tierId: change.tierId,
            quantity: change.after,
            lastCountAt: new Date(),
          },
        });
      } else {
        const updated = await tx.merchantStock.updateMany({
          where: {
            id: change.stockId,
            merchantId: MERCHANT_ID,
            productId: change.productId,
            tierId: change.tierId,
            quantity: change.before,
          },
          data: { quantity: change.after, lastCountAt: new Date() },
        });
        if (updated.count !== 1) throw new Error(`STOP: stock changed during correction for ${change.sku}`);
      }

      await tx.merchantStockTxn.create({
        data: {
          txnNumber: `SENPET-POS-FIX-20260930-${String(index + 1).padStart(2, '0')}`,
          merchantId: MERCHANT_ID,
          productId: change.productId,
          type: 'adjust',
          quantity: change.after - change.before,
          balanceAfter: change.after,
          note: `${NOTE} · ${change.name} ${change.before} → ${change.after}`,
        },
      });
    }
  }, { maxWait: 30_000, timeout: 120_000 });

  const verified = await loadPlan();
  if (verified.changes.length !== 0) {
    throw new Error(`STOP: post-update verification found ${verified.changes.length} pending changes`);
  }
  console.log(JSON.stringify({ result: 'updated-and-verified' }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
