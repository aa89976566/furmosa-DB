import type { Order, OrderItem, Shipment } from '@prisma/client';
import type { ProductOption } from '@/app/(main)/orders/new/order-form';
import type { MerchantOrderMode } from '@/lib/orders/merchant-order-mode';
import { resolveOrderItemUnitCost } from '@/lib/order-item-cost';
import { findMerchantWholesalePrice } from '@/lib/orders/merchant-wholesale-price';

export type OrderEditInitial = {
  orderId: string;
  orderNumber: string;
  orderType: 'merchant' | 'customer';
  customerSource: 'social' | 'line' | 'consignment';
  customerId: string;
  merchantId: string;
  merchantOrderMode: MerchantOrderMode;
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
  shippingMethod: 'home' | 'convenience' | 'delivery';
  cvsBrand: string;
  cvsStoreName: string;
  shippingAddress: string;
  note: string;
};

export type OrderCreateInitial = Omit<OrderEditInitial, 'orderId' | 'orderNumber'>;

function genKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveOrderType(order: Pick<Order, 'source' | 'merchantId' | 'customerId'>) {
  if (
    (order.source === 'consignment' || order.source === 'wholesale') &&
    order.merchantId &&
    !order.customerId
  ) {
    return 'merchant' as const;
  }
  return 'customer' as const;
}

function deriveCustomerSource(order: Pick<Order, 'source'>) {
  if (order.source === 'line') return 'line' as const;
  if (order.source === 'consignment') return 'consignment' as const;
  return 'social' as const;
}

function deriveMerchantOrderMode(
  order: Pick<Order, 'source'>,
  items: OrderItem[],
  products: ProductOption[],
): MerchantOrderMode {
  if (order.source === 'wholesale') return 'wholesale';
  if (
    items.length > 0 &&
    items.every((item) =>
      products.find((product) => product.id === item.productId)?.productCategory === 'JAR_EXCHANGE',
    )
  ) {
    return 'jar_exchange';
  }
  return 'consignment';
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

function normalizeSku(sku: string | null | undefined) {
  return sku?.trim().toLowerCase() ?? '';
}

/**
 * 歷史訂單畫面使用保存於 OrderItem 的名稱／SKU；複製時也必須以該快照為準。
 * SKU 唯一符合時優先使用，避免舊 productId 對到目前不同的商品。
 */
function resolveCopiedProduct(item: OrderItem, products: ProductOption[]) {
  const sourceSku = normalizeSku(item.sku);
  if (sourceSku) {
    const skuMatches = products.filter((product) => normalizeSku(product.sku) === sourceSku);
    if (skuMatches.length === 1) return skuMatches[0];
    return undefined;
  }
  return products.find((product) => product.id === item.productId);
}

export function buildOrderEditInitial(
  order: Order & { items: OrderItem[] },
  shipment: Shipment | null | undefined,
  products: ProductOption[],
): OrderEditInitial {
  const orderType = deriveOrderType(order);
  const customerSource = deriveCustomerSource(order);
  const merchantOrderMode = deriveMerchantOrderMode(order, order.items, products);

  const items = order.items.map((item) => {
    const retailUnitPrice = item.isGift ? item.unitCost ?? 0 : item.unitPrice;
    const tierId = resolveTierId(item, products);
    const product = products.find((candidate) => candidate.id === item.productId);
    const selectedTier = product?.priceTiers.find((tier) => tier.id === tierId);
    return {
      key: genKey(),
      productId: item.productId,
      tierId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost ?? 0,
      isGift: item.isGift,
      retailUnitPrice,
      weightGrams: item.weightGrams ?? selectedTier?.weightGrams ?? null,
      unit: item.unit ?? selectedTier?.unit ?? product?.unit ?? null,
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
    merchantOrderMode,
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
    shippingMethod:
      order.shippingMethod === 'convenience' || order.shippingMethod === 'delivery'
        ? order.shippingMethod
        : 'home',
    cvsBrand: order.cvsBrand ?? '711',
    cvsStoreName: order.cvsStoreName ?? '',
    shippingAddress: order.shippingAddress ?? shipment?.recipientAddress ?? '',
    note: order.note ?? '',
  };
}

/**
 * 複製舊訂單為一張尚未送出的新單。
 * 對象、配送與品項沿用；付款重設，價格依目前商品主檔重新計算。
 */
export function buildOrderCreateInitial(
  order: Order & { items: OrderItem[] },
  shipment: Shipment | null | undefined,
  products: ProductOption[],
): OrderCreateInitial {
  const { orderId: _orderId, orderNumber: _orderNumber, ...initial } =
    buildOrderEditInitial(order, shipment, products);

  const items = initial.items.map((item, index) => {
    const sourceItem = order.items[index];
    const product = sourceItem
      ? resolveCopiedProduct(sourceItem, products)
      : products.find((candidate) => candidate.id === item.productId);
    if (!product) {
      return sourceItem?.sku?.trim()
        ? { ...item, productId: '', tierId: '', quantity: sourceItem.quantity }
        : item;
    }

    const tierId = sourceItem
      ? resolveTierId({ ...sourceItem, productId: product.id }, products)
      : item.tierId;
    const tier = product.priceTiers.find((candidate) => candidate.id === tierId);
    const catalogPrice = tier?.price ?? product.price;
    const wholesalePrice = findMerchantWholesalePrice(
      product.wholesalePrices,
      initial.merchantId,
      product.id,
      tierId,
    ) ?? 0;
    const retailUnitPrice = initial.orderType === 'customer'
      ? catalogPrice
      : initial.merchantOrderMode === 'consignment'
        ? product.merchantSuggestedPrice ?? catalogPrice
        : initial.merchantOrderMode === 'wholesale'
          ? wholesalePrice
          : 0;

    return {
      ...item,
      productId: product.id,
      tierId,
      quantity: sourceItem?.quantity ?? item.quantity,
      unitPrice: item.isGift ? 0 : retailUnitPrice,
      retailUnitPrice,
      unitCost: resolveOrderItemUnitCost(product, tierId),
      weightGrams: sourceItem?.weightGrams ?? tier?.weightGrams ?? null,
      unit: sourceItem?.unit ?? tier?.unit ?? product.unit ?? null,
    };
  });

  return { ...initial, items, paymentStatus: 'unpaid' };
}

export function isOrderEditable(order: Pick<Order, 'status' | 'subscriptionId'>) {
  if (order.subscriptionId) return { ok: false as const, reason: '訂閱衍生訂單請至訂閱管理修改' };
  if (order.status === 'completed') return { ok: false as const, reason: '已完成訂單無法修改' };
  if (order.status === 'cancelled') return { ok: false as const, reason: '已取消訂單無法修改，請先復原狀態' };
  return { ok: true as const };
}
