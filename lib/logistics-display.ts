import { CARRIER_711 } from '@/lib/carrier-cvs';
import {
  merchantCarrierLabel,
  profileDefaults,
  type MerchantProfile,
} from '@/lib/merchant-shipping-defaults';

export type LogisticsInfo = {
  carrierLabel: string;
  destination: string;
  contactName: string;
  phone: string;
};

const cvsBrandLabel: Record<string, string> = {
  '711': '7-ELEVEN',
  familymart: '全家',
  hilife: '萊爾富',
};

export function resolveLogisticsFromMerchant(
  merchant: MerchantProfile & { name: string },
): LogisticsInfo {
  const d = profileDefaults(merchant);
  const carrier = merchant.preferredCarrier?.trim() || d.defaultCarrier;
  return {
    carrierLabel: merchantCarrierLabel(carrier),
    destination: d.pickupStore || '—',
    contactName: d.pickupName,
    phone: d.pickupPhone || '—',
  };
}

type OrderShipping = {
  shippingMethod?: string | null;
  shippingAddress?: string | null;
  cvsBrand?: string | null;
  cvsStoreId?: string | null;
  cvsStoreName?: string | null;
  customer?: { name?: string | null; phone?: string | null; address?: string | null } | null;
};

export function resolveLogisticsFromOrder(order: OrderShipping): LogisticsInfo {
  if (order.shippingMethod === 'delivery') {
    return {
      carrierLabel: '送貨',
      destination:
        order.shippingAddress?.trim() ||
        order.customer?.address?.trim() ||
        '—',
      contactName: order.customer?.name?.trim() || '—',
      phone: order.customer?.phone?.trim() || '—',
    };
  }
  if (order.shippingMethod === 'convenience') {
    const brand = order.cvsBrand
      ? (cvsBrandLabel[order.cvsBrand] ?? order.cvsBrand)
      : '超商取貨';
    const store = order.cvsStoreName?.trim() || order.shippingAddress?.trim() || '';
    return {
      carrierLabel: brand,
      destination: store || order.shippingAddress?.trim() || '—',
      contactName: order.customer?.name?.trim() || '—',
      phone: order.customer?.phone?.trim() || '—',
    };
  }
  return {
    carrierLabel: '宅配',
    destination:
      order.shippingAddress?.trim() ||
      order.customer?.address?.trim() ||
      '—',
    contactName: order.customer?.name?.trim() || '—',
    phone: order.customer?.phone?.trim() || '—',
  };
}

type ShipmentLogisticsInput = {
  type: string;
  carrier?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  merchant?: (MerchantProfile & { name: string }) | null;
  order?: OrderShipping | null;
};

export function resolveLogisticsFromShipment(input: ShipmentLogisticsInput): LogisticsInfo {
  const { type, merchant, order } = input;
  const carrier = input.carrier?.trim() || '';
  const recipientName = input.recipientName?.trim() || '';
  const recipientPhone = input.recipientPhone?.trim() || '';
  const recipientAddress = input.recipientAddress?.trim() || '';

  if (type === 'merchant_restock' && merchant) {
    const fromProfile = resolveLogisticsFromMerchant(merchant);
    const destination =
      recipientAddress ||
      (carrier === CARRIER_711 && merchant.pickupStoreName
        ? `7-11 · ${merchant.pickupStoreName.trim()}`
        : '') ||
      fromProfile.destination;

    return {
      carrierLabel: carrier
        ? merchantCarrierLabel(carrier)
        : fromProfile.carrierLabel,
      destination: destination || fromProfile.destination,
      contactName: recipientName || fromProfile.contactName,
      phone: recipientPhone || fromProfile.phone,
    };
  }

  if (order?.shippingMethod) {
    const fromOrder = resolveLogisticsFromOrder(order);
    return {
      carrierLabel: carrier || fromOrder.carrierLabel,
      destination: recipientAddress || fromOrder.destination,
      contactName: recipientName || fromOrder.contactName,
      phone: recipientPhone || fromOrder.phone,
    };
  }

  const addr = recipientAddress;
  const destination =
    addr?.startsWith('7-11') || addr?.startsWith('7-ELEVEN')
      ? addr
      : addr || (merchant ? resolveLogisticsFromMerchant(merchant).destination : '—');

  return {
    carrierLabel: carrier
      ? merchantCarrierLabel(carrier)
      : merchant
        ? resolveLogisticsFromMerchant(merchant).carrierLabel
        : '—',
    destination,
    contactName:
      recipientName ||
      order?.customer?.name?.trim() ||
      merchant?.contactName?.trim() ||
      merchant?.name ||
      '—',
    phone: recipientPhone || order?.customer?.phone?.trim() || merchant?.phone?.trim() || '—',
  };
}

/** 訂單列表：優先出貨單，其次訂單運輸欄位，寄賣單則顯示店家預設運輸 */
export function resolveLogisticsForOrderList(order: {
  source: string;
  shippingMethod?: string | null;
  shippingAddress?: string | null;
  cvsBrand?: string | null;
  cvsStoreId?: string | null;
  cvsStoreName?: string | null;
  customer?: { name?: string | null; phone?: string | null; address?: string | null } | null;
  merchant?: (MerchantProfile & { name: string }) | null;
  shipments?: Array<{
    carrier?: string | null;
    recipientName?: string | null;
    recipientPhone?: string | null;
    recipientAddress?: string | null;
    type?: string;
  }>;
}): LogisticsInfo {
  const latest = order.shipments?.[0];
  if (latest) {
    return resolveLogisticsFromShipment({
      type: latest.type ?? 'customer_order',
      carrier: latest.carrier,
      recipientName: latest.recipientName,
      recipientPhone: latest.recipientPhone,
      recipientAddress: latest.recipientAddress,
      merchant: order.merchant ?? null,
      order,
    });
  }
  if (order.shippingMethod) {
    return resolveLogisticsFromOrder(order);
  }
  if (order.merchant) {
    return resolveLogisticsFromMerchant(order.merchant);
  }
  return {
    carrierLabel: '—',
    destination: '—',
    contactName: order.customer?.name?.trim() || '—',
    phone: order.customer?.phone?.trim() || '—',
  };
}
