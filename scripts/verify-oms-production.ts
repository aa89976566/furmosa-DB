import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { runReview } from '../lib/orders/review-service';
import { shopifySnapshot, snapshotHash } from '../lib/shopify/intake-policy';

const token = randomUUID().replace(/-/g, '').slice(0, 12);
const orderNumber = `E2E-OMS-${token}`;
const sku = `E2E-${token}`;
const shopifyId = String(Date.now()) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
let orderId: string | null = null;
let productId: string | null = null;
let userId: string | null = null;

async function cleanup() {
  if (orderId) {
    await prisma.statusAuditLog.deleteMany({ where: { entityId: orderId } }).catch(() => {});
    await prisma.shipment.deleteMany({ where: { orderId } }).catch(() => {});
    await prisma.order.deleteMany({ where: { id: orderId } }).catch(() => {});
  }
  if (productId) {
    await prisma.inventoryBalance.deleteMany({ where: { productId } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: productId } }).catch(() => {});
  }
  if (userId) await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
}

async function main() {
  const warehouse = await prisma.warehouse.findUnique({ where: { code: 'WH-MAIN' } });
  if (!warehouse) throw new Error('WH-MAIN missing');

  const user = await prisma.user.create({
    data: {
      email: `e2e-${token}@example.invalid`,
      name: 'OMS E2E Test',
      role: 'admin',
      passwordHash: 'E2E-NOT-A-LOGIN',
    },
  });
  userId = user.id;

  const product = await prisma.product.create({
    data: {
      productId: `PROD-E2E-${token}`,
      sku,
      sourceSku: sku,
      name: `OMS E2E Product ${token}`,
      category: 'other',
      productCategory: 'STANDARD',
      unit: '件',
      price: 100,
      cost: 10,
      status: 'active',
      defaultTemperature: 'ambient',
      priceTiers: {
        create: {
          weightGrams: null,
          unit: '件',
          unitQty: 1,
          price: 100,
          sku,
          shopifySku: sku,
          status: 'active',
        },
      },
      inventoryBalances: {
        create: { warehouseId: warehouse.id, quantity: 100, unit: '件', lastCountedAt: new Date() },
      },
    },
  });
  productId = product.id;

  const updatedAt = new Date().toISOString();
  const snapshot = shopifySnapshot({
    id: shopifyId,
    name: `#E2E-${token}`,
    currency: 'TWD',
    updated_at: updatedAt,
    created_at: updatedAt,
    processed_at: updatedAt,
    financial_status: 'paid',
    fulfillment_status: 'unfulfilled',
    subtotal_price: '100.00',
    total_discounts: '0.00',
    total_price: '160.00',
    total_shipping_price_set: { shop_money: { amount: '60.00' } },
    email: `e2e-${token}@example.invalid`,
    shipping_address: {
      name: '測試收件人',
      phone: '0912345678',
      city: '台北市',
      address1: '測試地址 1 號',
    },
    shipping_lines: [{ title: '黑貓宅配', code: 'HOME' }],
    line_items: [{
      sku,
      title: `OMS E2E Product ${token}`,
      quantity: 1,
      price: '100.00',
      requires_shipping: true,
    }],
  });

  const order = await prisma.order.create({
    data: {
      orderNumber,
      source: 'shopify',
      externalStore: `e2e-${token}.myshopify.com`,
      externalOrderId: shopifyId,
      externalOrderName: `#E2E-${token}`,
      omsStatus: 'NEW',
      status: 'pending_review',
      paymentStatus: 'paid',
      fulfillmentStatus: 'pending',
      subtotal: 100,
      discount: 0,
      shippingFee: 60,
      total: 160,
      shippingMethod: 'home',
      shippingAddress: '測試地址 1 號',
      orderedAt: new Date(updatedAt),
      shopifySnapshot: snapshot,
      shopifySourceUpdatedAt: new Date(updatedAt),
    },
  });
  orderId = order.id;

  const hash = snapshotHash(snapshot);
  const draft = {
    lines: [],
    method: 'home',
    temperature: '',
    recipient: '測試收件人',
    phone: '0912345678',
    address: '測試地址 1 號',
    storeId: '',
    storeName: '',
    giftsConfirmed: false,
    duplicateConfirmed: false,
  };

  const checked = await runReview(prisma, {
    orderId: order.id,
    actorId: user.id,
    sourceHash: hash,
    action: 'check',
    draft,
    sourceOnly: true,
  });
  if (!checked.ok || checked.omsStatus !== 'REVIEW') {
    throw new Error(`check failed: ${JSON.stringify(checked)}`);
  }

  const approved = await runReview(prisma, {
    orderId: order.id,
    actorId: user.id,
    sourceHash: hash,
    action: 'approve',
    draft,
    sourceOnly: true,
  });

  const after = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { shipments: { where: { status: { not: 'cancelled' } } } },
  });

  if (!approved.ok || approved.action !== 'ship') throw new Error(`approve did not ship: ${JSON.stringify(approved)}`);
  if (after.omsStatus !== 'FULFILLMENT_PENDING') throw new Error(`unexpected omsStatus: ${after.omsStatus}`);
  if (after.status !== 'confirmed') throw new Error(`unexpected order status: ${after.status}`);
  if (after.shipments.length !== 1) throw new Error(`expected 1 shipment, got ${after.shipments.length}`);
  const shipment = after.shipments[0]!;
  if (approved.next?.href !== `/shipments?s=${encodeURIComponent(shipment.id)}`) {
    throw new Error(`wrong navigation href: ${approved.next?.href}`);
  }

  const retry = await runReview(prisma, {
    orderId: order.id,
    actorId: user.id,
    sourceHash: hash,
    action: 'approve',
    draft,
    sourceOnly: true,
  });
  const shipmentCount = await prisma.shipment.count({ where: { orderId: order.id, status: { not: 'cancelled' } } });
  if (!retry.ok || retry.action !== 'ship' || shipmentCount !== 1) {
    throw new Error(`retry not idempotent: ${JSON.stringify({ retry, shipmentCount })}`);
  }

  console.log(JSON.stringify({
    ok: true,
    check: checked.omsStatus,
    finalOmsStatus: after.omsStatus,
    finalOrderStatus: after.status,
    shipmentCount,
    navigation: approved.next?.href,
    retryNavigation: retry.next?.href,
  }));
}

main()
  .catch((error) => {
    console.error('[OMS_E2E_FAILED]', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
