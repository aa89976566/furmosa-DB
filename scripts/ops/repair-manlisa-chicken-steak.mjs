import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const WRONG_SKU = 'FUR-0024';
const RIGHT_SKU = 'FUR-0002';
const QUANTITY = 7;
const EXPECTED_ITEMS = new Map([
  ['FUR-0NaN', 16],
  ['FUR-0028', 1],
  ['FUR-0003', 4],
  ['FUR-0022', 7],
  [WRONG_SKU, QUANTITY],
]);

function publicSummary(shipment) {
  return {
    shipmentNumber: shipment.shipmentNumber,
    orderNumber: shipment.order?.orderNumber ?? null,
    merchant: shipment.merchant?.name ?? null,
    status: shipment.status,
    itemCount: shipment.items.length,
    totalQuantity: shipment.items.reduce((sum, item) => sum + item.quantity, 0),
    items: shipment.items.map(({ sku, productName, quantity, weightGrams, unit }) => ({
      sku,
      productName,
      quantity,
      weightGrams,
      unit,
    })),
    restockRequest: shipment.restockRequest
      ? { id: shipment.restockRequest.id, status: shipment.restockRequest.status }
      : null,
  };
}

function exactExpectedItems(items) {
  return (
    items.length === EXPECTED_ITEMS.size &&
    items.every((item) => EXPECTED_ITEMS.get(item.sku) === item.quantity)
  );
}

async function loadTarget(db = prisma) {
  const candidates = await db.shipment.findMany({
    where: {
      type: 'merchant_restock',
      recipientPhone: '0909226587',
      merchant: { name: { contains: '曼利莎' } },
      items: { some: { sku: WRONG_SKU, quantity: QUANTITY } },
    },
    include: {
      merchant: { select: { id: true, name: true } },
      items: { orderBy: { id: 'asc' } },
      order: { include: { items: { orderBy: { id: 'asc' } } } },
      restockRequest: { include: { items: { orderBy: { id: 'asc' } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const exact = candidates.filter((shipment) => exactExpectedItems(shipment.items));
  if (exact.length !== 1) {
    throw new Error(`STOP: expected exactly one matching Manlisa shipment, found ${exact.length}`);
  }
  return exact[0];
}

async function loadReplacement(db = prisma) {
  const product = await db.product.findUnique({
    where: { sku: RIGHT_SKU },
    include: { priceTiers: true },
  });
  if (!product || product.status !== 'active') {
    throw new Error('STOP: active chicken-steak product FUR-0002 was not found');
  }
  const tiers = product.priceTiers.filter(
    (tier) => tier.unit === '片' && tier.unitQty === 1 && (tier.weightGrams === 50 || tier.weightGrams === null),
  );
  if (tiers.length !== 1) {
    throw new Error(`STOP: expected one chicken-steak piece tier, found ${tiers.length}`);
  }
  return { product, tier: tiers[0] };
}

async function main() {
  const before = await loadTarget();
  const { product, tier } = await loadReplacement();
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'preflight',
    target: publicSummary(before),
    replacement: {
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      tier: { id: tier.id, weightGrams: tier.weightGrams, unit: tier.unit, unitQty: tier.unitQty },
    },
  }, null, 2));

  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx);
    const replacement = await loadReplacement(tx);
    if (!['pending', 'packed'].includes(target.status) || target.hqInventoryEligible) {
      throw new Error(`STOP: shipment is already in ${target.status}; inventory reconciliation is required`);
    }
    if (!target.order || target.order.hqInventoryEligible) {
      throw new Error('STOP: linked pending order was not found or is already inventory-eligible');
    }

    const wrongShipmentItems = target.items.filter(
      (item) => item.sku === WRONG_SKU && item.quantity === QUANTITY,
    );
    const wrongOrderItems = target.order.items.filter(
      (item) => item.sku === WRONG_SKU && item.quantity === QUANTITY,
    );
    if (wrongShipmentItems.length !== 1 || wrongOrderItems.length !== 1) {
      throw new Error('STOP: wrong product was not unique in shipment and order');
    }

    const stockTxns = await tx.merchantStockTxn.count({
      where: { shipmentItemId: { in: target.items.map((item) => item.id) } },
    });
    const hqTxns = await tx.inventoryTransaction.count({
      where: {
        reference: { in: [`shipment:${target.id}`, `order:${target.order.id}`] },
      },
    });
    if (stockTxns !== 0 || hqTxns !== 0) {
      throw new Error('STOP: inventory was already posted; automatic line replacement is unsafe');
    }

    const spec = {
      productId: replacement.product.id,
      productName: replacement.product.name,
      sku: replacement.product.sku,
      weightGrams: replacement.tier.weightGrams,
      unit: replacement.tier.unit,
    };
    await tx.shipmentItem.update({
      where: { id: wrongShipmentItems[0].id },
      data: { ...spec, variantKey: replacement.tier.id },
    });
    await tx.orderItem.update({
      where: { id: wrongOrderItems[0].id },
      data: { ...spec, variantKey: replacement.tier.id },
    });

    if (target.restockRequest) {
      const requestItems = target.restockRequest.items.filter(
        (item) => item.productId === wrongShipmentItems[0].productId &&
          item.approvedQuantity === QUANTITY,
      );
      if (requestItems.length !== 1) {
        throw new Error('STOP: matching restock request item was not unique');
      }
      await tx.restockRequestItem.update({
        where: { id: requestItems[0].id },
        data: {
          productId: replacement.product.id,
          weightGrams: replacement.tier.weightGrams,
          variantKey: replacement.tier.id,
        },
      });

      const snapshot = target.restockRequest.approvedSnapshot;
      if (!Array.isArray(snapshot)) throw new Error('STOP: approved snapshot is missing');
      let changed = 0;
      const nextSnapshot = snapshot.map((line) => {
        if (
          line && typeof line === 'object' &&
          line.productId === wrongShipmentItems[0].productId &&
          Number(line.quantity) === QUANTITY
        ) {
          changed += 1;
          return {
            ...line,
            productId: replacement.product.id,
            productName: replacement.product.name,
            sku: replacement.product.sku,
            weightGrams: replacement.tier.weightGrams,
            variantKey: replacement.tier.id,
            unit: replacement.tier.unit,
          };
        }
        return line;
      });
      if (changed !== 1) throw new Error('STOP: approved snapshot line was not unique');
      await tx.restockRequest.update({
        where: { id: target.restockRequest.id },
        data: { approvedSnapshot: nextSnapshot },
      });
    }

    const correction = '[資料修正 2026-09-18] 雞肉丁凍乾 30g ×7 → 雞排 ×7；同步 HQ 與店家 POS';
    await tx.shipment.update({
      where: { id: target.id },
      data: { notes: target.notes ? `${target.notes}\n${correction}` : correction },
    });
    await tx.order.update({
      where: { id: target.order.id },
      data: { note: target.order.note ? `${target.order.note}\n${correction}` : correction },
    });
  }, { maxWait: 15_000, timeout: 30_000 });

  const after = await loadTarget().catch(() => null);
  const corrected = await prisma.shipment.findFirst({
    where: {
      type: 'merchant_restock',
      recipientPhone: '0909226587',
      merchant: { name: { contains: '曼利莎' } },
      items: { some: { sku: RIGHT_SKU, quantity: QUANTITY } },
    },
    include: {
      merchant: { select: { id: true, name: true } },
      items: { orderBy: { id: 'asc' } },
      order: { include: { items: { orderBy: { id: 'asc' } } } },
      restockRequest: { include: { items: { orderBy: { id: 'asc' } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (after || !corrected || !exactExpectedItems(corrected.items.map((item) => (
    item.sku === RIGHT_SKU ? { ...item, sku: WRONG_SKU } : item
  )))) {
    throw new Error('STOP: post-update verification failed');
  }
  console.log(JSON.stringify({ result: 'updated', target: publicSummary(corrected) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
