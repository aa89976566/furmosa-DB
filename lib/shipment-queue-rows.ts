import type { ShipmentQueueRow } from '@/components/shipments/shipment-queue-table';
import { canonicalProductName } from '@/lib/product-label';
import { displayOrderNumber } from '@/lib/orders/display-order-number';
import type { OmsStatus } from '@/lib/orders/oms';
import { normalizeStoredShopifyRecipient } from '@/lib/shopify/recipient-name';

export type QueueFee = {
  fulfillmentFeeLabel: string | null;
  paymentReviewHold: boolean;
};

export type QueueOrderSource = {
  id: string;
  orderNumber: string;
  source?: string | null;
  externalOrderName?: string | null;
  status: string;
  paymentStatus: string;
  shippingFeeType?: string | null;
  shippingMethod: string;
  cvsBrand?: string | null;
  cvsStoreId?: string | null;
  cvsStoreName?: string | null;
  omsStatus?: OmsStatus | null;
  shopifySnapshot?: unknown;
};

export type QueueShipmentSource = {
  id: string;
  shipmentNumber?: string | null;
  type?: string | null;
  status?: string | null;
  createdAt?: Date | string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  merchantId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  subscriptionShipmentId?: string | null;
  itemsUnavailable?: boolean;
  merchant?: ShipmentQueueRow['merchant'] | null;
  customer?: { id: string; name?: string | null } | null;
  order?: QueueOrderSource | null;
  items?: Array<{
    productId?: string | null;
    productName?: string | null;
    quantity?: number | null;
    weightGrams?: number | null;
    productFound?: boolean;
  }>;
  subscriptionShipment?: {
    shipmentNo?: string | null;
    scheduledDate?: Date | string | null;
    subscription?: {
      subscriptionNo?: string | null;
      plan?: { name?: string | null; contents?: string | null } | null;
    } | null;
  } | null;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isoDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function gapRow(shipment: QueueShipmentSource): ShipmentQueueRow {
  return {
    id: text(shipment.id) || 'unknown',
    shipmentNumber: text(shipment.shipmentNumber) || '資料缺漏',
    type: text(shipment.type) || 'customer_order',
    status: text(shipment.status) || 'pending',
    createdAt: isoDate(shipment.createdAt) ?? new Date(0).toISOString(),
    carrier: text(shipment.carrier) || null,
    trackingNumber: text(shipment.trackingNumber) || null,
    recipientName: text(shipment.recipientName) || null,
    recipientPhone: text(shipment.recipientPhone) || null,
    recipientAddress: text(shipment.recipientAddress) || null,
    merchant: null,
    customer: null,
    order: null,
    fulfillmentFeeLabel: null,
    paymentReviewHold: false,
    inventoryWarnings: [],
    items: [],
    subscriptionShipment: null,
    gaps: ['資料缺漏'],
  };
}

/** 單筆壞資料只標成缺漏，不讓整頁出貨清單中斷。 */
export function assembleShipmentQueueRow(
  shipment: QueueShipmentSource,
  fee: QueueFee,
  inventoryWarnings: string[],
): ShipmentQueueRow {
  try {
    const gaps: string[] = [];
    const order = shipment.order ?? null;
    if (shipment.orderId && !order) gaps.push('訂單未對應');
    const merchant = shipment.merchant ?? null;
    if (shipment.merchantId && !merchant) gaps.push('店家未對應');
    const customer = shipment.customer ?? null;
    if (shipment.customerId && !customer) gaps.push('顧客未對應');

    const subscriptionShipment = shipment.subscriptionShipment ?? null;
    if (shipment.type === 'subscription' && shipment.subscriptionShipmentId && !subscriptionShipment) {
      gaps.push('訂閱出貨未對應');
    }
    const subscription = subscriptionShipment?.subscription ?? null;
    if (subscriptionShipment && !subscription) gaps.push('訂閱未對應');
    const plan = subscription?.plan ?? null;
    if (shipment.type === 'subscription' && subscription && !text(plan?.name)) {
      gaps.push('方案未對應');
    }

    const items = (shipment.items ?? []).map((item) => {
      const productName = canonicalProductName(text(item.productName));
      if (item.productId && item.productFound === false) gaps.push('商品未對應');
      if (!productName) gaps.push('資料缺漏');
      return {
        productName: productName || '資料缺漏',
        weightGrams: typeof item.weightGrams === 'number' ? item.weightGrams : null,
        quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 0,
      };
    });
    if (shipment.itemsUnavailable) gaps.push('資料缺漏');

    const uniqueGaps = [...new Set(gaps)];
    return {
      id: shipment.id,
      shipmentNumber: text(shipment.shipmentNumber) || '資料缺漏',
      type: text(shipment.type) || 'customer_order',
      status: text(shipment.status) || 'pending',
      createdAt: isoDate(shipment.createdAt) ?? new Date(0).toISOString(),
      carrier: shipment.carrier ?? null,
      trackingNumber: shipment.trackingNumber ?? null,
      recipientName: order?.omsStatus
        ? normalizeStoredShopifyRecipient(shipment.recipientName, order.shopifySnapshot)
        : shipment.recipientName ?? null,
      recipientPhone: shipment.recipientPhone ?? null,
      recipientAddress: shipment.recipientAddress ?? null,
      merchant: merchant
        ? {
            id: merchant.id,
            name: text(merchant.name) || '店家未對應',
            contactName: merchant.contactName,
            phone: merchant.phone,
            address: merchant.address,
            city: merchant.city,
            preferredCarrier: merchant.preferredCarrier,
            pickupStoreName: merchant.pickupStoreName,
          }
        : null,
      customer: customer
        ? { id: customer.id, name: text(customer.name) || '顧客未對應' }
        : null,
      order: order
        ? {
            id: order.id,
            orderNumber: text(order.orderNumber) || '訂單未對應',
            displayOrderNumber: displayOrderNumber({
              orderNumber: text(order.orderNumber) || '訂單未對應',
              source: order.source,
              externalOrderName: order.externalOrderName,
              shopifySnapshot: order.shopifySnapshot,
            }),
            omsStatus: order.omsStatus ?? null,
            status: order.status,
            paymentStatus: order.paymentStatus,
            shippingFeeType: order.shippingFeeType ?? undefined,
            shippingMethod: order.shippingMethod,
            cvsBrand: order.cvsBrand ?? null,
            cvsStoreId: order.cvsStoreId ?? null,
            cvsStoreName: order.cvsStoreName ?? null,
          }
        : null,
      fulfillmentFeeLabel: fee.fulfillmentFeeLabel,
      paymentReviewHold: fee.paymentReviewHold,
      inventoryWarnings,
      items,
      subscriptionShipment: subscriptionShipment
        ? {
            shipmentNo: text(subscriptionShipment.shipmentNo) || '資料缺漏',
            scheduledDate: isoDate(subscriptionShipment.scheduledDate),
            subscription: subscription
              ? {
                  subscriptionNo: text(subscription.subscriptionNo) || '訂閱未對應',
                  plan: text(plan?.name)
                    ? { name: text(plan?.name), contents: plan?.contents ?? null }
                    : null,
                }
              : null,
          }
        : null,
      gaps: uniqueGaps,
    };
  } catch (error) {
    console.error('[shipments-queue] skip row fields', shipment.id, error);
    return gapRow(shipment);
  }
}
