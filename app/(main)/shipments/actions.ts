'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const pad = (n: number, width = 4) => String(n).padStart(width, '0');
const ymd = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;

async function nextStockTxnNumber() {
  const prefix = `MTXN-${ymd()}-`;
  const last = await prisma.merchantStockTxn.findFirst({
    where: { txnNumber: { startsWith: prefix } },
    orderBy: { txnNumber: 'desc' },
  });
  const seq = last ? Number(last.txnNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 4)}`;
}

const TRANSITIONS: Record<string, string[]> = {
  pending: ['packed', 'cancelled'],
  packed: ['shipped', 'pending', 'cancelled'],
  shipped: ['delivered', 'packed'],
  delivered: [],
  cancelled: [],
};

export async function markShipmentStatus(formData: FormData) {
  const shipmentId = String(formData.get('shipmentId') ?? '');
  const next = String(formData.get('next') ?? '');
  const carrier = String(formData.get('carrier') ?? '').trim() || null;
  const trackingNumber = String(formData.get('trackingNumber') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!shipmentId) throw new Error('缺少出貨單');
  if (!['pending', 'packed', 'shipped', 'delivered', 'cancelled'].includes(next)) {
    throw new Error('狀態錯誤');
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { items: true },
  });
  if (!shipment) throw new Error('出貨單不存在');

  const allowed = TRANSITIONS[shipment.status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`「${shipment.status}」無法直接轉到「${next}」`);
  }

  const now = new Date();
  const data: Record<string, unknown> = { status: next };
  if (next === 'packed') data.packedAt = now;
  if (next === 'shipped') data.shippedAt = now;
  if (next === 'delivered') data.deliveredAt = now;
  if (next === 'cancelled') data.cancelledAt = now;
  if (carrier !== null) data.carrier = carrier;
  if (trackingNumber !== null) data.trackingNumber = trackingNumber;
  if (note !== null) {
    data.notes = shipment.notes
      ? `${shipment.notes}\n[${next}] ${note}`
      : `[${next}] ${note}`;
  }

  await prisma.shipment.update({ where: { id: shipmentId }, data });

  // 副作用：交付完成
  if (next === 'delivered') {
    if (shipment.type === 'merchant_restock' && shipment.merchantId) {
      // 把貨真的記到店家庫存
      for (const item of shipment.items) {
        const stock = await prisma.merchantStock.upsert({
          where: {
            merchantId_productId: {
              merchantId: shipment.merchantId,
              productId: item.productId,
            },
          },
          update: { quantity: { increment: item.quantity }, lastRestockAt: now },
          create: {
            merchantId: shipment.merchantId,
            productId: item.productId,
            quantity: item.quantity,
            lastRestockAt: now,
          },
        });
        await prisma.merchantStockTxn.create({
          data: {
            txnNumber: await nextStockTxnNumber(),
            merchantId: shipment.merchantId,
            productId: item.productId,
            type: 'restock',
            quantity: item.quantity,
            balanceAfter: stock.quantity,
            note: `來自出貨單 ${shipment.shipmentNumber}`,
          },
        });
      }
    }
    if (shipment.type === 'customer_order' && shipment.orderId) {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: {
          fulfillmentStatus: 'delivered',
          status: 'delivered',
          shippedAt: shipment.shippedAt ?? now,
          completedAt: now,
        },
      });
    }
    if (shipment.subscriptionShipmentId) {
      await prisma.subscriptionShipment.update({
        where: { id: shipment.subscriptionShipmentId },
        data: { status: 'delivered', deliveredAt: now },
      });
    }
  }

  if (next === 'shipped' && shipment.subscriptionShipmentId) {
    await prisma.subscriptionShipment.update({
      where: { id: shipment.subscriptionShipmentId },
      data: { status: 'shipped', shippedAt: now, trackingNo: trackingNumber },
    });
  }
  if (next === 'shipped' && shipment.type === 'customer_order' && shipment.orderId) {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: { fulfillmentStatus: 'shipped', status: 'shipped', shippedAt: now },
    });
  }

  if (next === 'packed' && shipment.subscriptionShipmentId) {
    await prisma.subscriptionShipment.update({
      where: { id: shipment.subscriptionShipmentId },
      data: { status: 'packed', packedAt: now },
    });
  }
  if (next === 'packed' && shipment.type === 'customer_order' && shipment.orderId) {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: { fulfillmentStatus: 'packed', status: 'packed' },
    });
  }

  revalidatePath('/shipments');
  revalidatePath(`/shipments/${shipmentId}`);
  if (shipment.merchantId) revalidatePath(`/merchants/${shipment.merchantId}`);
  if (shipment.orderId) revalidatePath(`/orders/${shipment.orderId}`);
  redirect(`/shipments/${shipmentId}`);
}
