'use server';

import { prisma } from '@/lib/prisma';
import { has711PickupInfo, is711Carrier, tryResolve711PickupFromForm } from '@/lib/carrier-cvs';
import { applyMerchantRestockFromShipment } from '@/lib/merchant-restock-inventory';
import { buildOrderUpdateFromShipmentStatus } from '@/lib/shipment-order-sync';
import {
  buildSubscriptionShipmentUpdate,
  refreshSubscriptionNextShipmentDate,
  type SubscriptionShipmentStatus,
} from '@/lib/subscription-shipment-status';
import { parsePlanContents, type PlanContentItem } from '@/lib/plan-contents';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const TRANSITIONS: Record<string, string[]> = {
  pending: ['shipped', 'cancelled'],
  packed: ['shipped', 'pending', 'cancelled'],
  shipped: ['delivered', 'pending'],
  delivered: ['shipped', 'pending'],
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
    // 表單空白時保留出貨單既有取件資訊（避免必填門市欄空白把寄賣出貨擋住）
    const pickup711 = tryResolve711PickupFromForm(formData, carrier);
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

    if (shipment.orderId) {
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

    if (shipment.subscriptionShipmentId) {
      if (next === 'shipped') {
        await tx.subscriptionShipment.update({
          where: { id: shipment.subscriptionShipmentId },
          data: buildSubscriptionShipmentUpdate('shipped', now),
        });
      } else if (next === 'delivered') {
        await tx.subscriptionShipment.update({
          where: { id: shipment.subscriptionShipmentId },
          data: buildSubscriptionShipmentUpdate('delivered', now),
        });
      } else if (next === 'pending' || next === 'packed') {
        await tx.subscriptionShipment.update({
          where: { id: shipment.subscriptionShipmentId },
          data: buildSubscriptionShipmentUpdate(
            next as SubscriptionShipmentStatus,
            now,
          ),
        });
      } else if (next === 'cancelled') {
        await tx.subscriptionShipment.update({
          where: { id: shipment.subscriptionShipmentId },
          data: buildSubscriptionShipmentUpdate('skipped', now),
        });
      }

      const subRow = await tx.subscriptionShipment.findUnique({
        where: { id: shipment.subscriptionShipmentId },
        select: { subscriptionId: true },
      });
      if (subRow) {
        await refreshSubscriptionNextShipmentDate(tx, subRow.subscriptionId);
      }
    }

    if (
      (next === 'shipped' || next === 'delivered') &&
      shipment.type === 'merchant_restock' &&
      shipment.merchantId
    ) {
      await applyMerchantRestockFromShipment(
        tx,
        {
          shipmentNumber: shipment.shipmentNumber,
          merchantId: shipment.merchantId,
          items: shipment.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            weightGrams: item.weightGrams,
          })),
        },
        now,
      );
    }
  });

  revalidatePath('/shipments');
  revalidatePath('/subscriptions/shipments');
  revalidatePath('/subscriptions');
  revalidatePath('/orders');
  revalidatePath(`/shipments/${shipmentId}`);
  if (shipment.merchantId) revalidatePath(`/merchants/${shipment.merchantId}`);
  if (shipment.orderId) revalidatePath(`/orders/${shipment.orderId}`);
  if (shipment.subscriptionShipmentId) {
    const subShip = await prisma.subscriptionShipment.findUnique({
      where: { id: shipment.subscriptionShipmentId },
      select: { subscriptionId: true },
    });
    if (subShip) revalidatePath(`/subscriptions/${subShip.subscriptionId}`);
  }

  const inline = formData.get('inline') === '1';
  const queueStatus = String(formData.get('queueStatus') ?? '').trim();
  const queueType = String(formData.get('queueType') ?? '').trim();
  if (inline) {
    const params = new URLSearchParams();
    if (next === 'shipped') {
      params.set('s', shipmentId);
      params.set('status', 'shipped');
      redirect(`/shipments?${params.toString()}`);
      return;
    }
    if (next === 'delivered') {
      redirect('/shipments');
      return;
    }
    params.set('s', shipmentId);
    if (queueStatus) params.set('status', queueStatus);
    if (queueType) params.set('type', queueType);
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
