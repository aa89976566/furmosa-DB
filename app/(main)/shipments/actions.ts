'use server';
import { guardLegacyOrderTx } from '@/lib/shopify/legacy-gate';

import { prisma } from '@/lib/prisma';
import {
  has711PickupInfo,
  hasConveniencePickupReady,
  is711Carrier,
  tryResolve711PickupFromForm,
} from '@/lib/carrier-cvs';
import { buildOrderUpdateFromShipmentStatus } from '@/lib/shipment-order-sync';
import {
  buildSubscriptionShipmentUpdate,
  refreshSubscriptionNextShipmentDate,
  type SubscriptionShipmentStatus,
} from '@/lib/subscription-shipment-status';
import { parsePlanContents, type PlanContentItem } from '@/lib/plan-contents';
import { SHIPPING_CARRIER_DELIVERY } from '@/lib/shipping-policy';
import {
  QIMU_DELIVERY_ADDRESS,
  QIMU_DELIVERY_PHONE,
  isQimuMerchantName,
} from '@/lib/stores/ensure-qimu-delivery';
import { isNextRedirect } from '@/lib/is-next-redirect';
import {
  canMarkJibaShipmentShipped,
  JIBA_PAYMENT_REVIEW_LABEL,
} from '@/lib/campaigns/jiba-two-piece/payment';
import {
  loadJibaChargeSourcesByOrderIds,
  resolveShipmentFulfillmentFee,
} from '@/lib/campaigns/jiba-two-piece/shipment-charge';
import { replaceJibaLegacyCatnipName } from '@/lib/campaigns/jiba-two-piece/constants';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { bustCacheTags } from '@/lib/runtime-cache';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { isOrderEditable } from '@/lib/orders/build-edit-initial';

const TRANSITIONS: Record<string, string[]> = {
  pending: ['packed', 'cancelled'],
  packed: ['shipped', 'pending', 'cancelled'],
  shipped: ['delivered', 'pending'],
  delivered: ['shipped', 'pending'],
  cancelled: [],
};

export type MarkShipmentStatusResult =
  | { ok: true; next: string; shipmentId: string }
  | { ok: false; error: string };

/** 詳情頁／面板表單用（必須回傳 void，才能當 form action） */
export async function markShipmentStatus(formData: FormData): Promise<void> {
  const inline = formData.get('inline') === '1';
  try {
    const result = await markShipmentStatusInner(formData);
    if (inline) {
      const params = new URLSearchParams();
      if (result.next === 'shipped') {
        params.set('s', result.shipmentId);
        params.set('status', 'shipped');
        redirect(`/shipments?${params.toString()}`);
      }
      if (result.next === 'delivered') {
        redirect('/shipments?delivered=1');
      }
      const queueStatus = String(formData.get('queueStatus') ?? '').trim();
      const queueType = String(formData.get('queueType') ?? '').trim();
      params.set('s', result.shipmentId);
      if (queueStatus) params.set('status', queueStatus);
      if (queueType) params.set('type', queueType);
      redirect(`/shipments?${params.toString()}`);
    }
    redirect(`/shipments/${result.shipmentId}`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error('[markShipmentStatus]', error);
    const shipmentId = String(formData.get('shipmentId') ?? '').trim();
    const message =
      error instanceof Error ? error.message : '更新出貨狀態失敗，請稍後再試';
    const params = new URLSearchParams();
    params.set('error', message.slice(0, 120));
    if (shipmentId) params.set('s', shipmentId);
    if (inline) {
      redirect(`/shipments?${params.toString()}`);
    }
    redirect(`/shipments/${shipmentId}?${params.toString()}`);
  }
}

/** 出貨隊列分段按鈕用：回傳結果給前端導向／顯示錯誤 */
export async function markShipmentStatusFromQueue(
  formData: FormData,
): Promise<MarkShipmentStatusResult> {
  try {
    const result = await markShipmentStatusInner(formData);
    return { ok: true, next: result.next, shipmentId: result.shipmentId };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    console.error('[markShipmentStatusFromQueue]', error);
    const message =
      error instanceof Error ? error.message : '更新出貨狀態失敗，請稍後再試';
    return { ok: false, error: message.slice(0, 120) };
  }
}

async function markShipmentStatusInner(
  formData: FormData,
): Promise<{ next: string; shipmentId: string }> {
  const shipmentId = String(formData.get('shipmentId') ?? '');
  const next = String(formData.get('next') ?? '');
  let carrier = String(formData.get('carrier') ?? '').trim() || null;
  const trackingNumber = String(formData.get('trackingNumber') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!shipmentId) throw new Error('缺少出貨單');

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      items: true,
      order: {
        select: {
          omsStatus: true,
          status: true,
          paymentStatus: true,
          shippingMethod: true,
          shippingAddress: true,
          cvsBrand: true,
          cvsStoreName: true,
        },
      },
      merchant: {
        select: {
          id: true,
          name: true,
          contactName: true,
          phone: true,
          address: true,
          preferredCarrier: true,
          pickupStoreName: true,
        },
      },
    },
  });
  if (!shipment) throw new Error('出貨單不存在');
  if (shipment.order?.omsStatus) {
    throw new Error('OMS 訂單尚未完成專用審核與物流流程，不可使用舊出貨操作');
  }
  if (
    shipment.type === 'merchant_restock' &&
    (shipment.status === 'delivered' || shipment.status === 'received')
  ) {
    throw new Error('店家補貨已送達或完成收貨，不可由 HQ 退回或變更狀態');
  }
  if (!['pending', 'packed', 'shipped', 'delivered', 'cancelled'].includes(next)) {
    throw new Error('狀態錯誤');
  }

  const allowed = TRANSITIONS[shipment.status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`「${shipment.status}」無法直接轉到「${next}」`);
  }
  if (
    next === 'shipped' &&
    !hasConveniencePickupReady({
      order: shipment.order,
      shipment,
    })
  ) {
    throw new Error('門市資料待確認：請先補齊超商與門市名稱');
  }
  // 已在途（shipped）再標「貨物到達」：不再重驗門市，避免舊單缺區域地址卡死
  const jibaSources = await loadJibaChargeSourcesByOrderIds([shipment.orderId]);
  const jiba = shipment.orderId ? jibaSources.get(shipment.orderId) ?? null : null;
  if (
    next === 'shipped' &&
    !canMarkJibaShipmentShipped({
      status: shipment.order?.status,
      paymentStatus: jiba?.paymentStatus ?? shipment.order?.paymentStatus,
      collected: jiba?.collectedDataJson,
      isJiba: Boolean(jiba),
    })
  ) {
    throw new Error(`此單仍在${JIBA_PAYMENT_REVIEW_LABEL}，不可標記已寄出`);
  }

  const now = new Date();
  const data: Prisma.ShipmentUpdateInput = { status: next };
  if (next === 'packed') data.packedAt = now;
  if (next === 'shipped') data.shippedAt = now;
  if (next === 'delivered') data.deliveredAt = now;
  if (next === 'cancelled') data.cancelledAt = now;
  if (next === 'pending') {
    data.shippedAt = null;
    data.deliveredAt = null;
    data.packedAt = null;
  }

  // 寄賣進貨：表單未帶物流時，沿用出貨單／店家預設（柒沐等直接送貨）
  if (shipment.type === 'merchant_restock' && (next === 'shipped' || next === 'delivered')) {
    const merchant = shipment.merchant;
    const resolvedCarrier =
      carrier ||
      shipment.carrier?.trim() ||
      merchant?.preferredCarrier?.trim() ||
      (merchant && isQimuMerchantName(merchant.name) ? SHIPPING_CARRIER_DELIVERY : null);

    if (resolvedCarrier) {
      carrier = resolvedCarrier;
      data.carrier = resolvedCarrier;
    }

    if (carrier === SHIPPING_CARRIER_DELIVERY || isQimuMerchantName(merchant?.name)) {
      data.carrier = SHIPPING_CARRIER_DELIVERY;
      carrier = SHIPPING_CARRIER_DELIVERY;
      const address =
        shipment.recipientAddress?.trim() ||
        merchant?.address?.trim() ||
        (isQimuMerchantName(merchant?.name) ? QIMU_DELIVERY_ADDRESS : '');
      const name =
        shipment.recipientName?.trim() ||
        merchant?.contactName?.trim() ||
        merchant?.name ||
        null;
      const phone =
        shipment.recipientPhone?.trim() ||
        merchant?.phone?.trim() ||
        (isQimuMerchantName(merchant?.name) ? QIMU_DELIVERY_PHONE : null);
      if (address) data.recipientAddress = address;
      if (name) data.recipientName = name;
      if (phone) data.recipientPhone = phone;
    }
  } else if (carrier !== null) {
    data.carrier = carrier;
  }

  if (trackingNumber !== null) data.trackingNumber = trackingNumber;

  if (is711Carrier(carrier)) {
    const pickup711 = tryResolve711PickupFromForm(formData, carrier);
    if (pickup711) {
      data.recipientName = pickup711.recipientName;
      data.recipientPhone = pickup711.recipientPhone;
      data.recipientAddress = pickup711.recipientAddress;
    } else if (
      shipment.type === 'merchant_restock' &&
      !has711PickupInfo({ ...shipment, carrier })
    ) {
      // 不要讓缺門市把整張出貨炸掉：改回沿用店家／既有收件，或改送貨
      const merchant = shipment.merchant;
      if (
        merchant?.preferredCarrier === SHIPPING_CARRIER_DELIVERY ||
        isQimuMerchantName(merchant?.name)
      ) {
        data.carrier = SHIPPING_CARRIER_DELIVERY;
        carrier = SHIPPING_CARRIER_DELIVERY;
        data.recipientAddress =
          shipment.recipientAddress?.trim() ||
          merchant?.address?.trim() ||
          QIMU_DELIVERY_ADDRESS;
        data.recipientName =
          shipment.recipientName?.trim() ||
          merchant?.contactName?.trim() ||
          merchant?.name ||
          null;
        data.recipientPhone =
          shipment.recipientPhone?.trim() ||
          merchant?.phone?.trim() ||
          QIMU_DELIVERY_PHONE;
      } else if (merchant?.address?.trim()) {
        data.carrier = merchant.preferredCarrier?.trim() || SHIPPING_CARRIER_DELIVERY;
        data.recipientAddress = merchant.address.trim();
        data.recipientName =
          shipment.recipientName?.trim() ||
          merchant.contactName?.trim() ||
          merchant.name;
        if (merchant.phone?.trim()) {
          data.recipientPhone = merchant.phone.trim();
        }
      }
      // 仍無資料時：只更新狀態，不覆寫收件欄位、不 throw
    }
  }

  if (note !== null) {
    data.notes = shipment.notes
      ? `${shipment.notes}\n[${next}] ${note}`
      : `[${next}] ${note}`;
  }

  // 先完成狀態更新；庫存寫入失敗不可讓「已寄出」整頁炸掉
  await prisma.$transaction(async (tx) => {
    if (shipment.orderId) await guardLegacyOrderTx(tx, shipment.orderId);
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
  });

  revalidatePath('/shipments');
  revalidatePath('/subscriptions/shipments');
  revalidatePath('/subscriptions');
  revalidatePath('/orders');
  revalidatePath('/dashboard');
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
  await bustCacheTags(
    CACHE_TAGS.dashboard,
    CACHE_TAGS.shipmentQueueCounts,
    CACHE_TAGS.orderHubTotals,
    CACHE_TAGS.merchantsPortfolio,
  );

  return { next, shipmentId };
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
    status: string;
    shippingMethod: string;
    cvsBrand: string | null;
    cvsStoreId: string | null;
    cvsStoreName: string | null;
    shippingAddress: string | null;
    paymentStatus: string;
    shippingFeeType: string;
    total: string;
    shippingFee: string;
    editable: boolean;
    editBlockedReason: string | null;
  } | null;
  fulfillmentFeeLabel: string | null;
  paymentReviewHold: boolean;
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

  const jibaSources = await loadJibaChargeSourcesByOrderIds([shipment.orderId]);
  const fee = resolveShipmentFulfillmentFee({
    orderStatus: shipment.order?.status,
    shippingFeeType: shipment.order?.shippingFeeType,
    jiba: shipment.orderId ? jibaSources.get(shipment.orderId) ?? null : null,
  });
  const orderEditable = shipment.order ? isOrderEditable(shipment.order) : null;

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
          status: shipment.order.status,
          shippingMethod: shipment.order.shippingMethod,
          cvsBrand: shipment.order.cvsBrand,
          cvsStoreId: shipment.order.cvsStoreId,
          cvsStoreName: shipment.order.cvsStoreName,
          shippingAddress: shipment.order.shippingAddress,
          paymentStatus: shipment.order.paymentStatus,
          shippingFeeType: shipment.order.shippingFeeType,
          total: String(shipment.order.total),
          shippingFee: String(shipment.order.shippingFee),
          editable: orderEditable?.ok ?? false,
          editBlockedReason: orderEditable?.ok ? null : (orderEditable?.reason ?? null),
        }
      : null,
    fulfillmentFeeLabel: fee.fulfillmentFeeLabel,
    paymentReviewHold: fee.paymentReviewHold,
    items: shipment.items.map((item) => ({
      id: item.id,
      productName: replaceJibaLegacyCatnipName(item.productName),
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
