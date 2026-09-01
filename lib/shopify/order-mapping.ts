import { shopifyLineItemHasIdentity } from '@/lib/shopify/match-line-item';
import { ShopifyWebhookClientError } from '@/lib/shopify/webhook-errors';

export type ShopifyMoney = { amount?: string | null };
export type ShopifyAttribute = { name?: string | null; value?: string | null };

export type ShopifyLineItem = {
  title?: string | null;
  variant_title?: string | null;
  sku?: string | null;
  quantity?: number | null;
  price?: string | null;
  grams?: number | null;
};

export type ShopifyPaidOrder = {
  id: number | string;
  name?: string | null;
  order_number?: number | null;
  email?: string | null;
  phone?: string | null;
  financial_status?: string | null;
  processed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  cancelled_at?: string | null;
  subtotal_price?: string | null;
  total_discounts?: string | null;
  total_price?: string | null;
  total_shipping_price_set?: { shop_money?: ShopifyMoney | null } | null;
  note_attributes?: ShopifyAttribute[] | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: {
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    company?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
  shipping_lines?: Array<{ title?: string | null }> | null;
  line_items?: ShopifyLineItem[] | null;
};

export type ShopifyFulfillmentPayload = {
  id: number | string;
  order_id: number | string;
  status?: string | null;
  shipment_status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type ShopifyRefundPayload = {
  id: number | string;
  order_id: number | string;
  created_at?: string | null;
  processed_at?: string | null;
};

export type ShopifyPickupInfo = {
  brand: string | null;
  city: string | null;
  district: string | null;
  storeName: string | null;
  storeId: string | null;
};

export function cleanShopifyText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function shopifyMoney(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ShopifyWebhookClientError('Shopify 金額格式錯誤');
  }
  return parsed;
}

function attribute(order: ShopifyPaidOrder, ...names: string[]): string | null {
  const accepted = new Set(names.map((name) => name.toLowerCase()));
  const row = (order.note_attributes ?? []).find((item) =>
    accepted.has(cleanShopifyText(item.name)?.toLowerCase() ?? ''),
  );
  return cleanShopifyText(row?.value);
}

export function shopifyPickupInfo(order: ShopifyPaidOrder): ShopifyPickupInfo {
  const brandValue = attribute(order, '超商品牌', '取貨超商', 'cvs_brand');
  const brandText = brandValue?.toLowerCase() ?? '';
  const brand = /全家|family/.test(brandText)
    ? 'familymart'
    : /萊爾富|hilife/.test(brandText)
      ? 'hilife'
      : /7-?11|7-eleven|統一/.test(brandText)
        ? '711'
        : cleanShopifyText(brandValue);

  return {
    brand,
    city: attribute(order, '取貨縣市', '門市縣市', 'cvs_city'),
    district: attribute(order, '取貨區域', '門市區域', 'cvs_district'),
    storeName: attribute(order, '取貨門市名稱', '門市名稱', 'cvs_store_name'),
    storeId: attribute(order, '取貨門市店號', '門市店號', 'cvs_store_id'),
  };
}

export function hasCompleteShopifyPickupInfo(order: ShopifyPaidOrder): boolean {
  const pickup = shopifyPickupInfo(order);
  return Boolean(pickup.brand && pickup.city && pickup.district && pickup.storeName);
}

export function shopifyAddressText(order: ShopifyPaidOrder): string | null {
  const a = order.shipping_address;
  if (!a) return null;
  return [a.zip, a.province, a.city, a.address1, a.address2, a.company]
    .map(cleanShopifyText)
    .filter(Boolean)
    .join(' ') || null;
}

export function isConveniencePickup(order: ShopifyPaidOrder): boolean {
  const pickup = shopifyPickupInfo(order);
  const text = [
    ...(order.shipping_lines ?? []).map((line) => line.title),
    order.shipping_address?.company,
    order.shipping_address?.address1,
    order.shipping_address?.address2,
  ]
    .map(cleanShopifyText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return Boolean(pickup.brand || pickup.storeName) || /7-?11|7-eleven|全家|超商|店到店/.test(text);
}

export function convenienceAddress(order: ShopifyPaidOrder): string | null {
  const pickup = shopifyPickupInfo(order);
  if (!pickup.storeName) return shopifyAddressText(order);
  return [pickup.city, pickup.district, `${pickup.storeName}門市`]
    .filter(Boolean)
    .join(' ');
}

export function shopifyPaymentStatus(status?: string | null) {
  switch (status) {
    case 'paid':
      return 'paid';
    case 'partially_paid':
    case 'partially_refunded':
      return 'partial';
    case 'refunded':
    case 'voided':
      return 'refunded';
    default:
      return 'unpaid';
  }
}

type WeightTier = { weightGrams: number | null; price: number };

export function resolveShopifyItemWeight(
  item: ShopifyLineItem,
  tiers: WeightTier[],
): number | null {
  const grams = Number(item.grams);
  if (Number.isInteger(grams) && grams > 0) return grams;

  const label = [cleanShopifyText(item.variant_title), cleanShopifyText(item.title)].filter(Boolean).join(' ');
  const labelMatch = label.match(/(?:^|\D)(\d{1,4})\s*g(?:\D|$)/i);
  if (labelMatch) return Number(labelMatch[1]);

  const unitPrice = shopifyMoney(item.price);
  const priceMatches = tiers.filter(
    (tier) => tier.weightGrams != null && tier.weightGrams > 0 && tier.price === unitPrice,
  );
  return priceMatches.length === 1 ? priceMatches[0].weightGrams : null;
}

/** Shopify 結帳內收取的運費屬於本張訂單，不能標成「已在別處付費」。 */
export function shopifyShippingFeeType(shippingFee: number) {
  return shippingFee > 0 ? 'unpaid' : 'free';
}

export function internalShopifyOrderNumber(order: ShopifyPaidOrder): string {
  const visible = order.order_number ?? cleanShopifyText(order.name)?.replace(/^#/, '') ?? 'ORDER';
  const suffix = String(order.id).replace(/\D/g, '').slice(-6);
  return `SHOP-${visible}-${suffix}`;
}

export function validateShopifyOrderPayload(order: ShopifyPaidOrder) {
  if (!order?.id) throw new ShopifyWebhookClientError('缺少 Shopify order id');
  const items = order.line_items ?? [];
  if (items.length === 0) throw new ShopifyWebhookClientError('Shopify 訂單沒有商品');
  for (const item of items) {
    if (!shopifyLineItemHasIdentity(item)) {
      throw new ShopifyWebhookClientError(`Shopify 商品缺少 SKU 或品名：${item.title ?? '未命名商品'}`);
    }
    if (!Number.isInteger(item.quantity) || Number(item.quantity) <= 0) {
      throw new ShopifyWebhookClientError(`Shopify 商品數量錯誤：${item.sku ?? item.title ?? '未命名商品'}`);
    }
    shopifyMoney(item.price);
  }
  shopifyMoney(order.subtotal_price);
  shopifyMoney(order.total_discounts);
  shopifyMoney(order.total_shipping_price_set?.shop_money?.amount);
  shopifyMoney(order.total_price);
}

export function validatePaidOrderPayload(order: ShopifyPaidOrder) {
  validateShopifyOrderPayload(order);
  if (order.financial_status && order.financial_status !== 'paid') {
    throw new ShopifyWebhookClientError(`Shopify 訂單尚未付款：${order.financial_status}`);
  }
}

export function shopifyExternalOrderId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}
