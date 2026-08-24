import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type ShopifyMoney = { amount?: string | null };
type ShopifyAddress = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  country?: string | null;
};

export type ShopifyOrderPayload = {
  id: number | string;
  name?: string | null;
  created_at?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  cancelled_at?: string | null;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
  subtotal_price?: string | null;
  total_discounts?: string | null;
  total_price?: string | null;
  total_shipping_price_set?: { shop_money?: ShopifyMoney | null } | null;
  customer?: {
    id?: number | string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: ShopifyAddress | null;
  line_items?: Array<{
    id?: number | string;
    sku?: string | null;
    name?: string | null;
    quantity?: number | null;
    price?: string | null;
    grams?: number | null;
  }> | null;
};

export class ShopifySyncError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

function money(value: string | null | undefined): number {
  const parsed = Number(value ?? '0');
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ShopifySyncError('Shopify 金額格式錯誤');
  }
  return Math.round(parsed * 100) / 100;
}

function requiredId(value: number | string): string {
  const id = String(value ?? '').trim();
  if (!/^\d+$/.test(id)) throw new ShopifySyncError('Shopify 訂單 ID 格式錯誤');
  return id;
}

function fullName(input?: {
  first_name?: string | null;
  last_name?: string | null;
} | null) {
  return [input?.last_name, input?.first_name].filter(Boolean).join(' ').trim();
}

function shippingAddress(address?: ShopifyAddress | null) {
  if (!address) return null;
  const parts = [
    address.zip,
    address.province,
    address.city,
    address.address1,
    address.address2,
    address.country,
  ].filter((part): part is string => Boolean(part?.trim()));
  return parts.join(' ').trim() || null;
}

function paymentStatus(status?: string | null) {
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

function orderedAt(value?: string | null) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ShopifySyncError('Shopify 下單時間格式錯誤');
  }
  return date;
}

export async function syncShopifyOrder(
  payload: ShopifyOrderPayload,
  shopDomain: string,
) {
  const shopifyId = requiredId(payload.id);
  const orderNumber = `SHOPIFY-${shopifyId}`;
  const shipmentNumber = `SHP-SHOPIFY-${shopifyId}`;

  const existing = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, orderNumber: true },
  });
  if (existing) return { created: false, order: existing };

  const rawItems = payload.line_items ?? [];
  if (rawItems.length === 0) throw new ShopifySyncError('Shopify 訂單沒有商品');
  const skus = rawItems.map((item) => item.sku?.trim() ?? '').filter(Boolean);
  if (skus.length !== rawItems.length) {
    throw new ShopifySyncError('Shopify 商品缺少 SKU，無法對應 Furmosa 商品');
  }

  const products = await prisma.product.findMany({
    where: { sku: { in: skus }, status: { not: 'inactive' } },
    select: { id: true, sku: true, name: true, unit: true },
  });
  const productsBySku = new Map(products.map((product) => [product.sku, product]));
  const missingSkus = [...new Set(skus.filter((sku) => !productsBySku.has(sku)))];
  if (missingSkus.length > 0) {
    throw new ShopifySyncError(`Furmosa 找不到 Shopify SKU：${missingSkus.join(', ')}`);
  }

  const items = rawItems.map((item) => {
    const sku = item.sku!.trim();
    const product = productsBySku.get(sku)!;
    const quantity = Number(item.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ShopifySyncError(`Shopify SKU ${sku} 的數量錯誤`);
    }
    const unitPrice = money(item.price);
    return {
      productId: product.id,
      productName: product.name,
      sku,
      quantity,
      unitPrice,
      subtotal: Math.round(unitPrice * quantity * 100) / 100,
      weightGrams: item.grams && item.grams > 0 ? Math.round(item.grams) : null,
      unit: product.unit,
    };
  });

  const subtotal = money(payload.subtotal_price);
  const discount = money(payload.total_discounts);
  const shippingFee = money(payload.total_shipping_price_set?.shop_money?.amount);
  const total = money(payload.total_price);
  const address = shippingAddress(payload.shipping_address);
  const recipientName =
    fullName(payload.shipping_address) || fullName(payload.customer) || 'Shopify 顧客';
  const recipientPhone =
    payload.shipping_address?.phone?.trim() ||
    payload.customer?.phone?.trim() ||
    payload.phone?.trim() ||
    null;
  const email = payload.customer?.email?.trim() || payload.email?.trim() || null;
  const customerShopifyId = payload.customer?.id ? String(payload.customer.id) : null;
  const cancelled = Boolean(payload.cancelled_at);
  const fulfilled = payload.fulfillment_status === 'fulfilled';

  try {
    const order = await prisma.$transaction(async (tx) => {
      let customerId: string | null = null;
      if (customerShopifyId) {
        const customer = await tx.customer.upsert({
          where: { customerId: `shopify-${customerShopifyId}` },
          update: {
            name: fullName(payload.customer) || recipientName,
            phone: recipientPhone,
            email,
            address,
          },
          create: {
            customerId: `shopify-${customerShopifyId}`,
            name: fullName(payload.customer) || recipientName,
            phone: recipientPhone,
            email,
            address,
            tags: JSON.stringify(['Shopify']),
            notes: '由 Shopify 訂單同步建立',
          },
          select: { id: true },
        });
        customerId = customer.id;
      }

      return tx.order.create({
        data: {
          orderNumber,
          source: 'shopify',
          status: cancelled ? 'cancelled' : fulfilled ? 'completed' : 'confirmed',
          paymentStatus: paymentStatus(payload.financial_status),
          shippingFeeType: shippingFee > 0 ? 'prepaid' : 'free',
          fulfillmentStatus: fulfilled ? 'delivered' : 'pending',
          customerId,
          subtotal,
          discount,
          shippingFee,
          total,
          shippingMethod: 'home',
          shippingAddress: address,
          note: [
            `Shopify ${payload.name ?? `#${shopifyId}`}`,
            `商店：${shopDomain || '未提供'}`,
            payload.note?.trim() || null,
          ]
            .filter(Boolean)
            .join('\n'),
          orderedAt: orderedAt(payload.created_at),
          completedAt: fulfilled ? new Date() : null,
          items: { create: items },
          shipments: {
            create: {
              shipmentNumber,
              type: 'customer_order',
              status: fulfilled ? 'delivered' : cancelled ? 'cancelled' : 'pending',
              customerId,
              recipientName,
              recipientPhone,
              recipientAddress: address,
              carrier: 'Shopify',
              deliveredAt: fulfilled ? new Date() : null,
              cancelledAt: cancelled ? new Date() : null,
              notes: `Shopify 訂單 ${payload.name ?? shopifyId}`,
              items: {
                create: items.map(({ unitPrice: _unitPrice, subtotal: _subtotal, ...item }) => item),
              },
            },
          },
        },
        select: { id: true, orderNumber: true },
      });
    });
    return { created: true, order };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true, orderNumber: true },
      });
      if (duplicate) return { created: false, order: duplicate };
    }
    throw error;
  }
}
