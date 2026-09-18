import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const expectedCount = 15;
const expectedDigest = process.env.EXPECTED_DIGEST?.trim() ?? '';

const candidateWhere = {
  deletedAt: null,
  source: 'shopify',
  omsStatus: { in: ['NEW', 'REVIEW'] },
};

const selection = {
  id: true,
  orderNumber: true,
  externalStore: true,
  externalOrderId: true,
  externalOrderName: true,
  omsStatus: true,
  paymentStatus: true,
  status: true,
  fulfillmentStatus: true,
  total: true,
  orderedAt: true,
  shopifySourceUpdatedAt: true,
  updatedAt: true,
  shippedAt: true,
  completedAt: true,
  merchantId: true,
  subscriptionId: true,
  hqInventoryEligible: true,
  _count: { select: { shipments: true, merchantStockTxns: true } },
};

function digest(rows) {
  const canonical = rows
    .map((row) => [
      row.id,
      row.externalStore,
      row.externalOrderId,
      row.shopifySourceUpdatedAt?.toISOString() ?? '',
      row.updatedAt.toISOString(),
    ].join('|'))
    .sort()
    .join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}

async function loadAndValidate(db) {
  const rows = await db.order.findMany({
    where: candidateWhere,
    select: selection,
    orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }],
  });
  if (rows.length !== expectedCount) {
    throw new Error(`STOP: expected exactly ${expectedCount} current Shopify pending orders, found ${rows.length}`);
  }

  for (const row of rows) {
    const safe = row.externalStore && row.externalOrderId
      && ['draft', 'pending_review', 'cancelled'].includes(row.status)
      && row.fulfillmentStatus === 'pending'
      && !row.shippedAt && !row.completedAt
      && !row.merchantId && !row.subscriptionId
      && !row.hqInventoryEligible
      && row._count.shipments === 0
      && row._count.merchantStockTxns === 0;
    if (!safe) throw new Error(`STOP: order ${row.orderNumber} has fulfillment, inventory, or identity state that blocks removal`);
  }

  const ids = rows.map((row) => row.id);
  const [campaigns, inventoryTransactions] = await Promise.all([
    db.campaignApplication.count({ where: { orderId: { in: ids } } }),
    db.inventoryTransaction.count({ where: { reference: { in: ids.map((id) => `order:${id}`) } } }),
  ]);
  if (campaigns !== 0 || inventoryTransactions !== 0) {
    throw new Error('STOP: at least one pending order has campaign or HQ inventory effects');
  }
  return rows;
}

function publicSummary(rows, batchDigest) {
  return {
    mode: apply ? 'apply' : 'preflight',
    count: rows.length,
    digest: batchDigest,
    orders: rows.map((row) => ({
      orderNumber: row.orderNumber,
      shopifyOrder: row.externalOrderName,
      omsStatus: row.omsStatus,
      paymentStatus: row.paymentStatus,
      total: row.total,
      orderedAt: row.orderedAt.toISOString(),
    })),
  };
}

async function main() {
  if (apply && !/^[a-f0-9]{64}$/.test(expectedDigest)) {
    throw new Error('STOP: apply requires the exact 64-character digest from preflight');
  }

  const before = await loadAndValidate(prisma);
  const beforeDigest = digest(before);
  console.log(JSON.stringify(publicSummary(before, beforeDigest), null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `target_digest=${beforeDigest}\n`);
  if (!apply) return;
  if (beforeDigest !== expectedDigest) throw new Error('STOP: pending-order set changed after preflight');

  const actorEmail = process.env.PRODUCTION_SMOKE_HQ_EMAIL?.trim().toLowerCase();
  if (!actorEmail) throw new Error('STOP: production admin identity is unavailable');

  const removedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('hq:remove-current-pending-shopify-orders:v1', 0))`;
    const actor = await tx.user.findUnique({ where: { email: actorEmail }, select: { id: true, role: true } });
    const hqRoles = new Set(['admin', 'staff', 'finance', 'warehouse']);
    if (!actor || !hqRoles.has(actor.role)) throw new Error('STOP: production actor is not a recognized HQ operator');

    const current = await loadAndValidate(tx);
    if (digest(current) !== expectedDigest) throw new Error('STOP: pending-order set changed while acquiring the production lock');
    const ids = current.map((row) => row.id);
    const result = await tx.order.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: {
        deletedAt: removedAt,
        deletedById: actor.id,
        deletionReason: '其他',
        omsReviewedAt: null,
        omsReviewedById: null,
        omsCheckedAt: null,
        omsCheckedSourceUpdatedAt: null,
      },
    });
    if (result.count !== expectedCount) throw new Error(`STOP: expected ${expectedCount} updates, wrote ${result.count}`);
    await tx.statusAuditLog.createMany({
      data: current.map((row) => ({
        entityType: 'order_deletion',
        entityId: row.id,
        previousStatus: row.omsStatus,
        newStatus: 'DELETED',
        actorType: 'user',
        actorId: actor.id,
        metadataJson: JSON.stringify({
          reason: '使用者核准移除目前 15 筆待處理資料',
          batchDigest: expectedDigest,
          actorRole: actor.role,
          executionMode: 'protected-production-workflow',
          shopifySourcePreserved: true,
        }),
      })),
    });
  }, { maxWait: 5000, timeout: 20000 });

  const remaining = await prisma.order.count({ where: candidateWhere });
  if (remaining !== 0) throw new Error(`STOP: apply committed but ${remaining} matching pending orders remain`);
  console.log(JSON.stringify({ applied: true, removed: expectedCount, remaining, shopifySourcePreserved: true }));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
