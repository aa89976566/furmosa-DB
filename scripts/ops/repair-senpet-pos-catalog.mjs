import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const MERCHANT_ID = 'cmtoebi6eefz5xppns';
const SHIPMENTS = [
  { number: 'SHP-202609-0003', status: 'shipped', expected: new Map([
    ['RF-anchovy-15', 1], ['RF-crystal-fish-10', 1], ['RF-beef-20', 1],
    ['RF-pig-ear-30', 1], ['RF-duck-throat-15', 1], ['RF-veggie-25', 1],
    ['RF-chicken-20', 1], ['FUR-0002', 5],
  ]) },
  { number: 'SHP-202609-0027', status: 'pending', expected: new Map([
    ['RF-pig-ear-30', 2], ['RF-veggie-25', 2], ['RF-chicken-20', 2],
  ]) },
];

const MAP = new Map([
  ['RF-anchovy-15', { sku: 'FUR-0023', weight: 15, price: 108 }],
  ['RF-crystal-fish-10', { sku: 'FUR-0028', weight: 10, price: 125 }],
  ['RF-beef-20', { sku: 'FUR-0022', weight: 20, price: 130 }],
  ['RF-pig-ear-30', { sku: 'FUR-0011', weight: 30, price: 114 }],
  ['RF-duck-throat-15', { sku: 'FUR-0008', weight: 15, price: 42 }],
  ['RF-veggie-25', { sku: 'FUR-0003', weight: 25, price: 130 }],
  ['RF-chicken-20', { sku: 'FUR-0024', weight: 20, price: 104 }],
]);

function exactLines(items, expected) {
  return items.length === expected.size &&
    items.every((item) => expected.get(item.sku) === item.quantity);
}

async function loadShipments(db = prisma) {
  const rows = await db.shipment.findMany({
    where: {
      merchantId: MERCHANT_ID,
      shipmentNumber: { in: SHIPMENTS.map((row) => row.number) },
      type: 'merchant_restock',
    },
    include: {
      items: { orderBy: { id: 'asc' } },
      order: { include: { items: { orderBy: { id: 'asc' } } } },
      restockRequest: { include: { items: { orderBy: { id: 'asc' } } } },
    },
    orderBy: { shipmentNumber: 'asc' },
  });
  if (rows.length !== SHIPMENTS.length) {
    throw new Error(`STOP: expected ${SHIPMENTS.length} shipments, found ${rows.length}`);
  }
  for (const config of SHIPMENTS) {
    const shipment = rows.find((row) => row.shipmentNumber === config.number);
    if (!shipment || shipment.status !== config.status || !exactLines(shipment.items, config.expected)) {
      throw new Error(`STOP: ${config.number} no longer matches the approved preflight`);
    }
  }
  return rows;
}

async function loadTargets(db = prisma) {
  const products = await db.product.findMany({
    where: { sku: { in: [...MAP.values()].map((row) => row.sku) } },
    include: { priceTiers: true },
  });
  const targets = new Map();
  for (const [sourceSku, config] of MAP) {
    const product = products.find((row) => row.sku === config.sku);
    if (!product || product.status !== 'active' || product.productCategory !== 'STANDARD') {
      throw new Error(`STOP: active STANDARD product ${config.sku} not found`);
    }
    const tiers = product.priceTiers.filter(
      (tier) => tier.weightGrams === config.weight && Number(tier.price) === config.price,
    );
    if (tiers.length !== 1) {
      throw new Error(`STOP: expected one ${config.sku} ${config.weight}g/$${config.price} tier, found ${tiers.length}`);
    }
    targets.set(sourceSku, { product, tier: tiers[0] });
  }
  return targets;
}

function summary(shipments, targets) {
  return shipments.map((shipment) => ({
    shipmentNumber: shipment.shipmentNumber,
    status: shipment.status,
    before: shipment.items.map((item) => ({
      sku: item.sku, name: item.productName, quantity: item.quantity, weightGrams: item.weightGrams,
    })),
    after: shipment.items.flatMap((item) => {
      if (shipment.shipmentNumber === 'SHP-202609-0003' && item.sku === 'FUR-0002') return [];
      const target = targets.get(item.sku);
      return [{
        sku: target?.product.sku ?? item.sku,
        name: target?.product.name ?? item.productName,
        quantity: item.quantity,
        weightGrams: target?.tier.weightGrams ?? item.weightGrams,
      }];
    }),
  }));
}

async function updateRequest(tx, shipment, sourceItem, target) {
  if (!shipment.restockRequest) return;
  const matches = shipment.restockRequest.items.filter(
    (item) => item.productId === sourceItem.productId && item.approvedQuantity === sourceItem.quantity,
  );
  if (matches.length !== 1) {
    throw new Error(`STOP: restock request line for ${sourceItem.sku} was not unique`);
  }
  await tx.restockRequestItem.update({
    where: { id: matches[0].id },
    data: {
      productId: target.product.id,
      weightGrams: target.tier.weightGrams,
      variantKey: target.tier.id,
    },
  });

  const snapshot = shipment.restockRequest.approvedSnapshot;
  if (!Array.isArray(snapshot)) return;
  let changed = 0;
  const nextSnapshot = snapshot.map((line) => {
    if (line && typeof line === 'object' &&
        line.productId === sourceItem.productId &&
        Number(line.quantity) === sourceItem.quantity) {
      changed += 1;
      return {
        ...line,
        productId: target.product.id,
        productName: target.product.name,
        sku: target.product.sku,
        weightGrams: target.tier.weightGrams,
        variantKey: target.tier.id,
        unit: target.tier.unit ?? target.product.unit,
      };
    }
    return line;
  });
  if (changed !== 1) throw new Error(`STOP: approved snapshot line for ${sourceItem.sku} was not unique`);
  await tx.restockRequest.update({
    where: { id: shipment.restockRequest.id },
    data: { approvedSnapshot: nextSnapshot },
  });
}

async function main() {
  const shipments = await loadShipments();
  const targets = await loadTargets();
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'preflight', changes: summary(shipments, targets) }, null, 2));
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    const current = await loadShipments(tx);
    const currentTargets = await loadTargets(tx);
    const itemIds = current.flatMap((shipment) => shipment.items.map((item) => item.id));
    const posted = await tx.merchantStockTxn.count({ where: { shipmentItemId: { in: itemIds } } });
    if (posted !== 0) throw new Error(`STOP: ${posted} shipment items already posted to merchant stock`);

    for (const shipment of current) {
      for (const sourceItem of shipment.items) {
        if (shipment.shipmentNumber === 'SHP-202609-0003' && sourceItem.sku === 'FUR-0002') {
          await tx.shipmentItem.delete({ where: { id: sourceItem.id } });
          continue;
        }
        const target = currentTargets.get(sourceItem.sku);
        if (!target) throw new Error(`STOP: no mapping for ${sourceItem.sku}`);
        const spec = {
          productId: target.product.id,
          productName: target.product.name,
          sku: target.product.sku,
          weightGrams: target.tier.weightGrams,
          variantKey: target.tier.id,
          unit: target.tier.unit ?? target.product.unit,
        };
        await tx.shipmentItem.update({ where: { id: sourceItem.id }, data: spec });

        if (!shipment.order) throw new Error(`STOP: ${shipment.shipmentNumber} has no linked order`);
        const orderMatches = shipment.order.items.filter(
          (item) => item.productId === sourceItem.productId && item.quantity === sourceItem.quantity,
        );
        if (orderMatches.length !== 1) {
          throw new Error(`STOP: order line for ${sourceItem.sku} was not unique`);
        }
        await tx.orderItem.update({ where: { id: orderMatches[0].id }, data: spec });
        await updateRequest(tx, shipment, sourceItem, target);
      }

      const correction = '[資料校正 2026-09-30] 森的汪星換罐 SKU 改綁一般 POS 規格；9/5 原味雞霸為贈品，不進可售庫存';
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { notes: shipment.notes ? `${shipment.notes}\n${correction}` : correction },
      });
      if (shipment.order) {
        await tx.order.update({
          where: { id: shipment.order.id },
          data: { note: shipment.order.note ? `${shipment.order.note}\n${correction}` : correction },
        });
      }
    }
  }, { maxWait: 30_000, timeout: 120_000 });

  const updated = await prisma.shipment.findMany({
    where: { merchantId: MERCHANT_ID, shipmentNumber: { in: SHIPMENTS.map((row) => row.number) } },
    include: { items: { orderBy: { id: 'asc' } } },
    orderBy: { shipmentNumber: 'asc' },
  });
  for (const shipment of updated) {
    const expectedCount = shipment.shipmentNumber === 'SHP-202609-0003' ? 7 : 3;
    if (shipment.items.length !== expectedCount ||
        shipment.items.some((item) => ![...MAP.values()].some((row) => row.sku === item.sku))) {
      throw new Error(`STOP: post-update verification failed for ${shipment.shipmentNumber}`);
    }
  }
  console.log(JSON.stringify({ result: 'updated', shipments: updated.map((shipment) => ({
    shipmentNumber: shipment.shipmentNumber,
    items: shipment.items.map((item) => ({ sku: item.sku, quantity: item.quantity, weightGrams: item.weightGrams })),
  })) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
