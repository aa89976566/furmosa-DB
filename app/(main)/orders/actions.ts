'use server';

import { prisma } from '@/lib/prisma';
import { parseOrderFormData } from '@/lib/orders/parse-order-form';
import { isOrderEditable } from '@/lib/orders/build-edit-initial';
import {
  orderTotalFromAmounts,
  resolveOrderShipping,
  shipmentCarrierFromOrder,
  SHIPPING_FEE_TYPES,
} from '@/lib/shipping-policy';
import {
  buildShipmentUpdateFromOrderStatus,
  fulfillmentStatusFromOrderStatus,
} from '@/lib/shipment-order-sync';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sendNewOrderPush } from '@/lib/web-push';
import {
  applyJarExchangeConsignmentPricing,
} from '@/lib/jar-exchange/revenue';
import {
  searchCustomersForOrderForm,
  searchProductsForOrderForm,
  type OrderFormProductScope,
} from '@/lib/order-form-search';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { bustCacheTags } from '@/lib/runtime-cache';
import { getCurrentUser } from '@/lib/auth';
import { safeOrderEditReturnTo } from '@/lib/orders/order-edit-return';
import { guardLegacyOrderTx } from '@/lib/shopify/legacy-gate';
import { nextSourceOrderNumber, SOURCE_ORDER_PREFIX } from '@/lib/orders/source-order-number';
import type { Prisma } from '@prisma/client';

const pad = (n: number, width = 3) => String(n).padStart(width, '0');

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function nextOrderNumber(tx: Prisma.TransactionClient) {
  const prefix = `ORD-${ymd()}-`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-number-v2:${prefix}`}))`;
  const last = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  const seq = last ? Number(last.orderNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 3)}`;
}

async function nextLineOrderNumber(tx: Prisma.TransactionClient) {
  const prefix = SOURCE_ORDER_PREFIX.line;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-number:${prefix}`}))`;
  const last = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });
  return nextSourceOrderNumber(prefix, last?.orderNumber);
}

async function nextShipmentNumber(tx: Prisma.TransactionClient) {
  const prefix = `SHP-${ymd()}-`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`shipment-number-v2:${prefix}`}))`;
  const last = await tx.shipment.findFirst({
    where: { shipmentNumber: { startsWith: prefix } },
    orderBy: { shipmentNumber: 'desc' },
    select: { shipmentNumber: true },
  });
  const seq = last ? Number(last.shipmentNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 4)}`;
}

const VALID_SHIPPING_FEE_TYPES = SHIPPING_FEE_TYPES;
const VALID_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'cod', 'refunded'] as const;

const VALID_ORDER_STATUSES = [
  'draft',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
] as const;

async function revalidateOrderPaths(
  orderId: string,
  merchantId?: string | null,
  customerId?: string | null,
) {
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/edit`);
  revalidatePath('/reviews');
  revalidatePath('/shipments');
  revalidatePath('/dashboard');
  if (merchantId) revalidatePath(`/merchants/${merchantId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
  await bustCacheTags(
    CACHE_TAGS.dashboard,
    CACHE_TAGS.orderHubTotals,
    CACHE_TAGS.shipmentQueueCounts,
    CACHE_TAGS.merchantsPortfolio,
  );
}

export type CreateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; message: string };

export async function createOrder(formData: FormData): Promise<CreateOrderResult> {
  let created: {
    id: string;
    orderNumber: string;
    total: number;
    source: string;
    merchantId: string | null;
    customerId: string | null;
  };

  try {
    const rawPayload = await parseOrderFormData(formData);
    const payload = applyJarExchangeConsignmentPricing(rawPayload);
    const isMerchantRestock = rawPayload.orderType === 'merchant' && !payload.customerId;

    created = await prisma.$transaction(async (tx) => {
      const orderNumber = payload.source === 'line'
        ? await nextLineOrderNumber(tx)
        : await nextOrderNumber(tx);
      const shipmentNumber = await nextShipmentNumber(tx);
    const order = await tx.order.create({
      data: {
        orderNumber,
        source: payload.source,
        status: 'confirmed',
        paymentStatus: payload.paymentStatus,
        shippingFeeType: payload.shippingFeeType,
        fulfillmentStatus: 'pending',
        customerId: payload.customerId,
        merchantId: payload.merchantId,
        subtotal: payload.subtotal,
        discount: payload.discount,
        shippingFee: payload.shippingFee,
        companyShippingCost: payload.companyShippingCost,
        giftCost: payload.giftCost,
        total: payload.total,
        shippingMethod: payload.shippingMethod,
        shippingAddress: payload.shippingAddress,
        cvsBrand: payload.cvsBrand,
        cvsStoreId: payload.cvsStoreId,
        cvsStoreName: payload.cvsStoreName,
        note: payload.note,
        orderedAt: new Date(),
        items: {
          create: payload.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            subtotal: it.lineSubtotal,
            isGift: it.isGift,
            unitCost: it.isGift ? it.unitCost : null,
            weightGrams: it.weightGrams,
            unit: it.unit,
          })),
        },
      },
      include: { items: true },
    });

    await tx.shipment.create({
      data: {
        shipmentNumber,
        type: isMerchantRestock ? 'merchant_restock' : 'customer_order',
        status: 'pending',
        merchantId: payload.merchantId,
        customerId: payload.customerId,
        orderId: order.id,
        recipientName: payload.recipientName,
        recipientPhone: payload.recipientPhone ?? payload.customer?.phone ?? null,
        recipientAddress: payload.shipmentRecipientAddress,
        carrier: payload.shipmentCarrier,
        notes: payload.shipmentNotes,
        items: {
          create: order.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            quantity: it.quantity,
            weightGrams: it.weightGrams,
            unit: it.unit,
          })),
        },
      },
    });

      return order;
    }, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    console.error('[orders/create] 建立訂單交易失敗', error);
    return {
      ok: false,
      message: '訂單未建立。請確認資料後重試；若仍失敗，請聯絡系統管理員。',
    };
  }

  try {
    await revalidateOrderPaths(created.id, created.merchantId, created.customerId);
  } catch (error) {
    // 訂單已成功提交，不應因快取更新失敗讓使用者誤以為需要重複送出。
    console.error('[orders/create] 訂單已建立，但畫面快取更新失敗', error);
  }
  void sendNewOrderPush({
    id: created.id,
    orderNumber: created.orderNumber,
    total: Number(created.total),
    source: created.source,
  });
  return { ok: true, orderId: created.id };
}

export async function updateOrder(formData: FormData) {
  const orderId = String(formData.get('orderId') ?? '').trim();
  if (!orderId) throw new Error('缺少訂單');
  await assertLegacyOrderActionAllowed(orderId);

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, subscriptionId: true, merchantId: true, customerId: true },
  });
  if (!existing) throw new Error('訂單不存在');

  const editable = isOrderEditable(existing);
  if (!editable.ok) throw new Error(editable.reason);

  const rawPayload = await parseOrderFormData(formData, { extendedPayment: true });
  const payload = applyJarExchangeConsignmentPricing(rawPayload);
  const isMerchantRestock = rawPayload.orderType === 'merchant' && !payload.customerId;

  await prisma.$transaction(async (tx) => {
    await guardLegacyOrderTx(tx, orderId);
    await tx.orderItem.deleteMany({ where: { orderId } });

    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        source: payload.source,
        paymentStatus: payload.paymentStatus,
        shippingFeeType: payload.shippingFeeType,
        customerId: payload.customerId,
        merchantId: payload.merchantId,
        subtotal: payload.subtotal,
        discount: payload.discount,
        shippingFee: payload.shippingFee,
        companyShippingCost: payload.companyShippingCost,
        giftCost: payload.giftCost,
        total: payload.total,
        shippingMethod: payload.shippingMethod,
        shippingAddress: payload.shippingAddress,
        cvsBrand: payload.cvsBrand,
        cvsStoreId: payload.cvsStoreId,
        cvsStoreName: payload.cvsStoreName,
        note: payload.note,
        items: {
          create: payload.items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            subtotal: it.lineSubtotal,
            isGift: it.isGift,
            unitCost: it.isGift ? it.unitCost : null,
            weightGrams: it.weightGrams,
            unit: it.unit,
          })),
        },
      },
      include: { items: true },
    });

    const shipments = await tx.shipment.findMany({
      where: { orderId },
      select: { id: true },
    });

    for (const shipment of shipments) {
      await tx.shipmentItem.deleteMany({ where: { shipmentId: shipment.id } });
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          type: isMerchantRestock ? 'merchant_restock' : 'customer_order',
          merchantId: payload.merchantId,
          customerId: payload.customerId,
          recipientName: payload.recipientName,
          recipientPhone: payload.recipientPhone ?? payload.customer?.phone ?? null,
          recipientAddress: payload.shipmentRecipientAddress,
          carrier: payload.shipmentCarrier,
          notes: payload.shipmentNotes,
          items: {
            create: order.items.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              sku: it.sku,
              quantity: it.quantity,
              weightGrams: it.weightGrams,
              unit: it.unit,
            })),
          },
        },
      });
    }
  });

  await revalidateOrderPaths(orderId, payload.merchantId, payload.customerId);
  const returnTo = safeOrderEditReturnTo(String(formData.get('returnTo') ?? ''));
  redirect(returnTo ?? `/orders/${orderId}`);
}

export async function updateOrderStatus(formData: FormData) {
  const orderId = String(formData.get('orderId') ?? '');
  const next = String(formData.get('status') ?? '');
  if (!orderId) throw new Error('缺少訂單');
  await assertLegacyOrderActionAllowed(orderId);
  if (!(VALID_ORDER_STATUSES as readonly string[]).includes(next)) {
    throw new Error('訂單狀態錯誤');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, shippedAt: true, completedAt: true },
  });
  if (!order) throw new Error('訂單不存在');

  const data: {
    status: string;
    fulfillmentStatus: string;
    shippedAt?: Date | null;
    completedAt?: Date | null;
  } = {
    status: next,
    fulfillmentStatus: fulfillmentStatusFromOrderStatus(next),
  };
  if (['shipped', 'delivered', 'completed'].includes(next) && !order.shippedAt) {
    data.shippedAt = new Date();
  }
  if (next === 'completed') {
    if (!order.completedAt) data.completedAt = new Date();
  } else {
    data.completedAt = null;
  }

  const shipmentUpdate = buildShipmentUpdateFromOrderStatus(next);

  await prisma.$transaction(async (tx) => {
    await guardLegacyOrderTx(tx, orderId);
    await tx.order.update({ where: { id: orderId }, data });

    if (shipmentUpdate) {
      await tx.shipment.updateMany({
        where: {
          orderId,
          type: 'customer_order',
          status: { not: 'cancelled' },
        },
        data: shipmentUpdate,
      });
    }
  });

  await revalidateOrderPaths(orderId);
}

export async function updateOrderPaymentStatus(formData: FormData) {
  const orderId = String(formData.get('orderId') ?? '');
  const next = String(formData.get('paymentStatus') ?? '');
  if (!orderId) throw new Error('缺少訂單');
  await assertLegacyOrderActionAllowed(orderId);
  if (!(VALID_PAYMENT_STATUSES as readonly string[]).includes(next)) {
    throw new Error('付款狀態錯誤');
  }
  await prisma.$transaction(async tx => {
    await guardLegacyOrderTx(tx, orderId);
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: next } });
  });
  await revalidateOrderPaths(orderId);
}

export async function updateOrderShippingFeeType(formData: FormData) {
  const orderId = String(formData.get('orderId') ?? '');
  const next = String(formData.get('shippingFeeType') ?? '');
  if (!orderId) throw new Error('缺少訂單');
  await assertLegacyOrderActionAllowed(orderId);
  if (!(VALID_SHIPPING_FEE_TYPES as readonly string[]).includes(next)) {
    throw new Error('運費類型錯誤');
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      subtotal: true,
      discount: true,
      shippingMethod: true,
      cvsBrand: true,
    },
  });
  if (!order) throw new Error('訂單不存在');

  const { shippingFee, companyShippingCost } = resolveOrderShipping({
    shippingFeeType: next,
    shippingMethod: order.shippingMethod,
    cvsBrand: order.cvsBrand,
  });
  const total = orderTotalFromAmounts(
    Number(order.subtotal),
    Number(order.discount),
    shippingFee,
  );

  const carrier = shipmentCarrierFromOrder({
    shippingMethod: order.shippingMethod,
    cvsBrand: order.cvsBrand,
  });

  await prisma.$transaction(async tx => {
    await guardLegacyOrderTx(tx, orderId);
    await tx.order.update({
      where: { id: orderId },
      data: { shippingFeeType: next, shippingFee, companyShippingCost, total },
    });
    await tx.shipment.updateMany({
      where: { orderId },
      data: { carrier },
    });
  });

  await revalidateOrderPaths(orderId);
}

export async function approveOrderForShipment(formData: FormData) {
  const orderId = String(formData.get('orderId') ?? '').trim();
  if (!orderId) throw new Error('缺少訂單');
  await assertLegacyOrderActionAllowed(orderId);
  const reviewer = await getCurrentUser();
  if (!reviewer) throw new Error('請先登入客服帳號');

  await prisma.$transaction(async (tx) => {
    await guardLegacyOrderTx(tx, orderId);
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true, shipments: { where: { status: { not: 'cancelled' } } } },
    });
    if (!order) throw new Error('訂單不存在');
    if (order.omsStatus) throw new Error('OMS 訂單必須完成專用檢查與審核，不可使用舊出貨操作');
    if (!order.externalStore || !order.externalOrderId) {
      throw new Error('只有 Shopify 匯入訂單可使用此審核流程');
    }
    if (order.paymentStatus !== 'paid') throw new Error('訂單尚未付款，不能通過出貨審核');
    const recipientNameMissing =
      !order.customer?.name?.trim() || order.customer.name.trim() === 'Shopify 客戶';
    const shippingMissingFields = [
      ...(recipientNameMissing ? ['收件人'] : []),
      ...(!order.customer?.phone?.trim() ? ['電話'] : []),
      ...(order.shippingMethod === 'home' && !order.shippingAddress?.trim() ? ['地址'] : []),
      ...(order.shippingMethod === 'convenience' && !order.cvsBrand?.trim() ? ['超商'] : []),
      ...(order.shippingMethod === 'convenience' && !order.cvsStoreName?.trim()
        ? ['門市名稱']
        : []),
      ...(order.shippingMethod === 'convenience' && !order.shippingAddress?.trim()
        ? ['門市所在地']
        : []),
    ];
    if (shippingMissingFields.length > 0) {
      throw new Error(`配送資料尚未確認，請先補齊${shippingMissingFields.join('、')}`);
    }
    if (order.status !== 'pending_review') {
      if (order.status === 'confirmed' && order.shipments.length > 0) return;
      throw new Error('訂單不在待審核狀態');
    }
    if (order.shipments.length > 0) throw new Error('此訂單已有出貨單，請先檢查重複資料');

    const prefix = `SHP-${ymd()}-`;
    const last = await tx.shipment.findFirst({
      where: { shipmentNumber: { startsWith: prefix } },
      orderBy: { shipmentNumber: 'desc' },
      select: { shipmentNumber: true },
    });
    const seq = last ? Number(last.shipmentNumber.slice(prefix.length)) + 1 : 1;

    await tx.shipment.create({
      data: {
        shipmentNumber: `${prefix}${pad(seq, 4)}`,
        type: 'customer_order',
        status: 'pending',
        customerId: order.customerId,
        orderId: order.id,
        recipientName: order.customer?.name ?? null,
        recipientPhone: order.customer?.phone ?? null,
        recipientAddress: order.shippingAddress,
        carrier: shipmentCarrierFromOrder(order),
        notes: `客服 ${reviewer.name} 審核通過`,
        items: {
          create: order.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            weightGrams: item.weightGrams,
            unit: item.unit,
          })),
        },
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { status: 'confirmed' } });
    await tx.statusAuditLog.create({
      data: {
        entityType: 'order',
        entityId: order.id,
        previousStatus: 'pending_review',
        newStatus: 'confirmed',
        actorType: 'supervisor',
        actorId: reviewer.userId,
        metadataJson: JSON.stringify({ reviewerName: reviewer.name, reviewerEmail: reviewer.email }),
      },
    });
  });

  await revalidateOrderPaths(orderId);
}

export async function searchCustomersForOrder(q: string, take = 40) {
  return searchCustomersForOrderForm(q, take);
}

async function assertLegacyOrderActionAllowed(orderId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('請先登入 HQ');
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { omsStatus: true } });
  if (order?.omsStatus) throw new Error('OMS 訂單正在收單與檢查階段，不可使用舊的修改或出貨操作');
}

export async function searchProductsForOrder(
  q: string,
  take = 40,
  scope: OrderFormProductScope = 'all',
  merchantId?: string,
) {
  return searchProductsForOrderForm(q, take, scope, merchantId);
}
