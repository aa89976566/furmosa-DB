import { shipmentCarrierFromOrder } from '@/lib/shipping-policy';

type LineShopShipmentItem = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  weightGrams: number | null;
  variantKey: string | null;
  unit: string | null;
};

type LineShopPaymentOrder = {
  source: string;
  externalStore: string | null;
  status: string;
  shippingMethod: string;
  shippingAddress: string | null;
  cvsBrand: string | null;
  cvsStoreId: string | null;
  cvsStoreName: string | null;
  customerId: string | null;
  customer: { name: string | null; phone: string | null } | null;
  note: string | null;
  items: LineShopShipmentItem[];
  shipments: Array<{ status: string }>;
};

export type LineShopShipmentPlan = {
  type: 'customer_order';
  status: 'pending';
  customerId: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  carrier: string;
  notes: string;
  items: LineShopShipmentItem[];
};

function labelledValue(note: string | null, label: string) {
  if (!note) return null;
  const prefix = `${label}：`;
  const line = note.split(/\r?\n/).find((entry) => entry.startsWith(prefix));
  const value = line?.slice(prefix.length).trim();
  return value || null;
}

export function readLineShopRecipientFromNote(note: string | null) {
  const rawPhone = labelledValue(note, '手機');
  const phone = rawPhone?.replace(/[\s()-]/g, '') ?? null;
  return {
    name: labelledValue(note, '收件人'),
    phone: phone && /^09\d{8}$/.test(phone) ? phone : null,
  };
}

export function planLineShopPaymentHandoff(
  order: LineShopPaymentOrder,
  paymentStatus: string,
): {
  orderData: { paymentStatus: string; status?: 'confirmed' };
  shipment: LineShopShipmentPlan | null;
} {
  const isLineShop = order.source === 'line' && order.externalStore === 'line-chat';
  if (!isLineShop || paymentStatus !== 'paid') {
    return { orderData: { paymentStatus }, shipment: null };
  }

  const orderData = { paymentStatus, status: 'confirmed' as const };
  if (order.shipments.some((shipment) => shipment.status !== 'cancelled')) {
    return { orderData, shipment: null };
  }

  const fromNote = readLineShopRecipientFromNote(order.note);
  const recipientName = fromNote.name || order.customer?.name?.trim() || null;
  const recipientPhone = fromNote.phone || order.customer?.phone?.trim() || null;
  const recipientAddress = order.shippingAddress?.trim() || null;
  const missing = [
    ...(!recipientName || !recipientPhone ? ['收件人姓名、手機'] : []),
    ...(!recipientAddress ? ['收件地址或門市'] : []),
    ...(order.items.length === 0 ? ['商品明細'] : []),
  ];
  if (!recipientName || !recipientPhone || !recipientAddress || order.items.length === 0) {
    throw new Error(`LINE 訂單尚缺${missing.join('、')}，不能標記已付款或建立出貨單`);
  }

  return {
    orderData,
    shipment: {
      type: 'customer_order',
      status: 'pending',
      customerId: order.customerId,
      recipientName,
      recipientPhone,
      recipientAddress,
      carrier: shipmentCarrierFromOrder({
        shippingMethod: order.shippingMethod,
        cvsBrand: order.cvsBrand,
      }),
      notes: 'LINE 對話購物｜人工轉帳已核帳',
      items: order.items.map((item) => ({ ...item })),
    },
  };
}
