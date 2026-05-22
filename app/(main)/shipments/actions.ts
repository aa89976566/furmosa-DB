'use server';

import { prisma } from '@/lib/prisma';
import { has711PickupInfo, is711Carrier, resolve711PickupFromForm } from '@/lib/carrier-cvs';
import { reserveStockTxnNumbers } from '@/lib/merchant-stock-txn-number';
import { buildOrderUpdateFromShipmentStatus } from '@/lib/shipment-order-sync';
import { parsePlanContents, type PlanContentItem } from '@/lib/plan-contents';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const TRANSITIONS: Record<string, string[]> = {
  pending: ['shipped', 'cancelled'],
  packed: ['shipped', 'pending', 'cancelled'],
  shipped: ['delivered', 'pending'],
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
  if (next === 'shipped') data.shippedAt = now;
  if (next === 'delivered') data.deliveredAt = now;
  if (next === 'cancelled') data.cancelledAt = now;
  if (next === 'pending') {
    data.shippedAt = null;
    data.deliveredAt = null;
    data.packedAt = null;
  }
  if (carrier !== null) data.carrier = carrier;
  if (trackingNumber !== null) data.trackingNumber = trackingNumber;

  if (is711Carrier(carrier)) {
    const pickup711 = resolve711PickupFromForm(formData, carrier);
    if (pickup711) {
      data.recipientName = pickup711.recipientName;
      data.recipientPhone = pickup711.recipientPhone;
      data.recipientAddress = pickup711.recipientAddress;
    } else if (shipment.type === 'merchant_restock' && !has711PickupInfo(shipment)) {
      throw new Error('物流為 7-11 時請填寫門市、收件人姓名與電話');
    }
  }
  if (note !== null) {
    data.notes = shipment.notes
      ? `${shipment.notes}\n[${next}] ${note}`
      : `[${next}] ${note}`;
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({ where: { id: shipmentId }, data });

    if (shipment.type === 'customer_order' && shipment.orderId) {
      const orderUpdate = buildOrderUpdateFromShipmentStatus(next, {
        existingShippedAt: shipment.shippedAt,
        shipmentShippedAt: next === 'shipped' ? now : shipment.shippedAt,
      });
      if (orderUpdate) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: orderUpdate,
        });
      }
    }

    if (next === 'shipped' && shipment.subscriptionShipmentId) {
      await tx.subscriptionShipment.update({
        where: { id: shipment.subscriptionShipmentId },
        data: { status: 'shipped', shippedAt: now, trackingNo: trackingNumber },
      });
    }
    if (next === 'delivered' && shipment.subscriptionShipmentId) {
      await tx.subscriptionShipment.update({
        where: { id: shipment.subscriptionShipmentId },
        data: { status: 'delivered', deliveredAt: now },
      });
    }

    if (next === 'delivered' && shipment.type === 'merchant_restock' && shipment.merchantId) {
      const txnNumbers = await reserveStockTxnNumbers(tx, shipment.items.length);
      for (let i = 0; i < shipment.items.length; i++) {
        const item = shipment.items[i];
        const stock = await tx.merchantStock.upsert({
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
        await tx.merchantStockTxn.create({
          data: {
            txnNumber: txnNumbers[i],
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
  });

  revalidatePath('/shipments');
  revalidatePath('/shipments/history');
  revalidatePath('/orders');
  revalidatePath('/orders/history');
  revalidatePath(`/shipments/${shipmentId}`);
  if (shipment.merchantId) revalidatePath(`/merchants/${shipment.merchantId}`);
  if (shipment.orderId) revalidatePath(`/orders/${shipment.orderId}`);

  const inline = formData.get('inline') === '1';
  const queueStatus = String(formData.get('queueStatus') ?? '').trim();
  if (inline) {
    const params = new URLSearchParams();
    if (next === 'shipped') {
      params.set('s', shipmentId);
      redirect(`/shipments/history?${params.toString()}`);
      return;
    }
    if (next === 'delivered') {
      redirect('/shipments');
      return;
    }
    params.set('s', shipmentId);
    if (queueStatus) params.set('status', queueStatus);
    redirect(`/shipments?${params.toString()}`);
    return;
  }

  redirect(`/shipments/${shipmentId}`);
}

export type ShipmentPanelData = {
  id: string;
  shipmentNumber: string;
  status: string;
  type: string;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  customer: { id: string; name: string } | null;
  merchant: {
    id: string;
    name: string;
    contactName: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    preferredCarrier: string | null;
    pickupStoreName: string | null;
  } | null;
  order: {
    id: string;
    orderNumber: string;
    shippingMethod: string;
    cvsBrand: string | null;
    cvsStoreId: string | null;
    cvsStoreName: string | null;
    shippingAddress: string | null;
    paymentStatus: string;
    shippingFeeType: string;
    total: string;
    shippingFee: string;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    sku: string;
    quantity: number;
    weightGrams: number | null;
    unit: string | null;
  }>;
  subscription: {
    subscriptionNo: string;
    shipmentNo: string;
    planName: string | null;
    planContents: PlanContentItem[];
  } | null;
};

export async function fetchShipmentPanel(shipmentId: string): Promise<ShipmentPanelData | null> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      customer: { select: { id: true, name: true } },
      merchant: {
        select: {
          id: true,
          name: true,
          contactName: true,
          phone: true,
          address: true,
          city: true,
          preferredCarrier: true,
          pickupStoreName: true,
        },
      },
      order: true,
      subscriptionShipment: {
        include: {
          subscription: { include: { plan: true } },
        },
      },
      items: { orderBy: { productName: 'asc' } },
    },
  });
  if (!shipment) return null;

  return {
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    status: shipment.status,
    type: shipment.type,
    recipientName: shipment.recipientName,
    recipientPhone: shipment.recipientPhone,
    recipientAddress: shipment.recipientAddress,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    customer: shipment.customer,
    merchant: shipment.merchant,
    order: shipment.order
      ? {
          id: shipment.order.id,
          orderNumber: shipment.order.orderNumber,
          shippingMethod: shipment.order.shippingMethod,
          cvsBrand: shipment.order.cvsBrand,
          cvsStoreId: shipment.order.cvsStoreId,
          cvsStoreName: shipment.order.cvsStoreName,
          shippingAddress: shipment.order.shippingAddress,
          paymentStatus: shipment.order.paymentStatus,
          shippingFeeType: shipment.order.shippingFeeType,
          total: String(shipment.order.total),
          shippingFee: String(shipment.order.shippingFee),
        }
      : null,
    items: shipment.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      weightGrams: item.weightGrams,
      unit: item.unit,
    })),
    subscription: shipment.subscriptionShipment
      ? {
          subscriptionNo: shipment.subscriptionShipment.subscription.subscriptionNo,
          shipmentNo: shipment.subscriptionShipment.shipmentNo,
          planName: shipment.subscriptionShipment.subscription.plan?.name ?? null,
          planContents: parsePlanContents(
            shipment.subscriptionShipment.subscription.plan?.contents,
          ),
        }
      : null,
  };
}
