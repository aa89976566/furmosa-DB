import type { Order, OrderItem, Shipment } from '@prisma/client';
import type { ProductOption } from '@/app/(main)/orders/new/order-form';

export type OrderEditInitial = {
  orderId: string;
  orderNumber: string;
  orderType: 'merchant' | 'customer';
  customerSource: 'social' | 'line' | 'consignment';
  customerId: string;
  merchantId: string;
  items: Array<{
    key: string;
    productId: string;
    tierId: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    isGift: boolean;
    retailUnitPrice: number;
    weightGrams: number | null;
    unit: string | null;
  }>;
  discount: number;
  shippingFeeType: 'free' | 'prepaid' | 'unpaid' | 'cod';
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'cod' | 'refunded';
  recipientName: string;
  recipientPhone: string;
  shippingMethod: 'home' | 'convenience';
  cvsBrand: string;
  cvsStoreName: string;
  shippingAddress: string;
  note: string;
};

function genKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveOrderType(order: Pick<Order, 'source' | 'merchantId' | 'customerId'>) {
  if (order.source === 'consignment' && order.merchantId && !order.customerId) {
    return 'merchant' as const;
  }
  return 'customer' as const;
}

function deriveCustomerSource(order: Pick<Order, 'source'>) {
  if (order.source === 'line') return 'line' as const;
  if (order.source === 'consignment') return 'consignment' as const;
  return 'social' as const;
}

function resolveTierId(
  item: OrderItem,
  products: ProductOption[],
): string {
  const prod = products.find((p) => p.id === item.productId);
  if (!prod || prod.priceTiers.length === 0) return '';

  if (item.weightGrams != null) {
    const byWeight = prod.priceTiers.find((t) => t.weightGrams === item.weightGrams);
    if (byWeight) return byWeight.id;
  }
  if (item.unit) {
    const byUnit = prod.priceTiers.find((t) => t.unit === item.unit);
    if (byUnit) return byUnit.id;
  }
  return prod.priceTiers[0]?.id ?? '';
}

export function buildOrderEditInitial(
  order: Order & { items: OrderItem[] },
  shipment: Shipment | null | undefined,
  products: ProductOption[],
): OrderEditInitial {
  const orderType = deriveOrderType(order);
  const customerSource = deriveCustomerSource(order);

  const items = order.items.map((item) => {
    const retailUnitPrice = item.isGift ? item.unitCost ?? 0 : item.unitPrice;
    return {
      key: genKey(),
      productId: item.productId,
      tierId: resolveTierId(item, products),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost ?? 0,
      isGift: item.isGift,
      retailUnitPrice,
      weightGrams: item.weightGrams,
      unit: item.unit,
    };
  });

  const shippingFeeType = (['free', 'prepaid', 'unpaid', 'cod'] as const).includes(
    order.shippingFeeType as 'free',
  )
    ? (order.shippingFeeType as OrderEditInitial['shippingFeeType'])
    : 'unpaid';

  const paymentStatus = (
    ['unpaid', 'partial', 'paid', 'cod', 'refunded'] as const
  ).includes(order.paymentStatus as 'unpaid')
    ? (order.paymentStatus as OrderEditInitial['paymentStatus'])
    : 'unpaid';

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderType,
    customerSource,
    customerId: order.customerId ?? '',
    merchantId: order.merchantId ?? '',
    items: items.length > 0 ? items : [
      {
        key: genKey(),
        productId: '',
        tierId: '',
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        isGift: false,
        retailUnitPrice: 0,
        weightGrams: null,
        unit: null,
      },
    ],
    discount: Number(order.discount),
    shippingFeeType,
    paymentStatus,
    recipientName: shipment?.recipientName ?? '',
    recipientPhone: shipment?.recipientPhone ?? '',
    shippingMethod: order.shippingMethod === 'convenience' ? 'convenience' : 'home',
    cvsBrand: order.cvsBrand ?? '711',
    cvsStoreName: order.cvsStoreName ?? '',
    shippingAddress: order.shippingAddress ?? shipment?.recipientAddress ?? '',
    note: order.note ?? '',
  };
}

export function isOrderEditable(order: Pick<Order, 'status' | 'subscriptionId'>) {
  if (order.subscriptionId) return { ok: false as const, reason: '訂閱衍生訂單請至訂閱管理修改' };
  if (order.status === 'completed') return { ok: false as const, reason: '已完成訂單無法修改' };
  if (order.status === 'cancelled') return { ok: false as const, reason: '已取消訂單無法修改，請先復原狀態' };
  return { ok: true as const };
}
