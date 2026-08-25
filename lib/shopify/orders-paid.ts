import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatCustomerId, maxCustomerIdSeq } from '@/lib/customers/customer-id-format';

type DbClient = PrismaClient | Prisma.TransactionClient;

type ShopifyMoney = { amount?: string | null };
type ShopifyAttribute = { name?: string | null; value?: string | null };

export type ShopifyPaidOrder = {
  id: number | string;
  name?: string | null;
  order_number?: number | null;
  email?: string | null;
  phone?: string | null;
  financial_status?: string | null;
  processed_at?: string | null;
  created_at?: string | null;
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
  line_items?: Array<{
    title?: string | null;
    variant_title?: string | null;
    sku?: string | null;
    quantity?: number | null;
    price?: string | null;
    grams?: number | null;
  }> | null;
};

export type ShopifyPickupInfo = {
  brand: string | null;
  city: string | null;
  district: string | null;
  storeName: string | null;
  storeId: string | null;
};

function money(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Shopify 金額格式錯誤');
  return parsed;
}

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function attribute(order: ShopifyPaidOrder, ...names: string[]): string | null {
  const accepted = new Set(names.map((name) => name.toLowerCase()));
  const row = (order.note_attributes ?? []).find((item) =>
    accepted.has(clean(item.name)?.toLowerCase() ?? ''),
  );
  return clean(row?.value);
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
        : clean(brandValue);

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

function fullName(order: ShopifyPaidOrder): string {
  const shipping = clean(order.shipping_address?.name);
  if (shipping) return shipping;
  const parts = [
    clean(order.customer?.first_name),
    clean(order.customer?.last_name),
  ].filter(Boolean);
  return parts.join(' ') || 'Shopify 客戶';
}

function addressText(order: ShopifyPaidOrder): string | null {
  const a = order.shipping_address;
  if (!a) return null;
  return [a.zip, a.province, a.city, a.address1, a.address2, a.company]
    .map(clean)
    .filter(Boolean)
    .join(' ') || null;
}

function isConveniencePickup(order: ShopifyPaidOrder): boolean {
  const pickup = shopifyPickupInfo(order);
  const text = [
    ...(order.shipping_lines ?? []).map((line) => line.title),
    order.shipping_address?.company,
    order.shipping_address?.address1,
    order.shipping_address?.address2,
  ]
    .map(clean)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return Boolean(pickup.brand || pickup.storeName) || /7-?11|7-eleven|全家|超商|店到店/.test(text);
}

function convenienceAddress(order: ShopifyPaidOrder): string | null {
  const pickup = shopifyPickupInfo(order);
  if (!pickup.storeName) return addressText(order);
  return [pickup.city, pickup.district, `${pickup.storeName}門市`]
    .filter(Boolean)
    .join(' ');
}

export function verifyShopifyWebhookHmac(rawBody: string, received: string, secret: string) {
  if (!received || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(received, 'base64');
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validateShopifyOrderPayload(order: ShopifyPaidOrder) {
  if (!order?.id) throw new Error('缺少 Shopify order id');
  const items = order.line_items ?? [];
  if (items.length === 0) throw new Error('Shopify 訂單沒有商品');
  for (const item of items) {
    if (!clean(item.sku)) throw new Error(`Shopify 商品缺少 SKU：${item.title ?? '未命名商品'}`);
    if (!Number.isInteger(item.quantity) || Number(item.quantity) <= 0) {
      throw new Error(`Shopify 商品數量錯誤：${item.sku}`);
    }
  }
}

export function validatePaidOrderPayload(order: ShopifyPaidOrder) {
  validateShopifyOrderPayload(order);
  if (order.financial_status && order.financial_status !== 'paid') {
    throw new Error(`Shopify 訂單尚未付款：${order.financial_status}`);
  }
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

type WeightTier = { weightGrams: number | null; price: number };

export function resolveShopifyItemWeight(
  item: NonNullable<ShopifyPaidOrder['line_items']>[number],
  tiers: WeightTier[],
): number | null {
  const grams = Number(item.grams);
  if (Number.isInteger(grams) && grams > 0) return grams;

  const label = [clean(item.variant_title), clean(item.title)].filter(Boolean).join(' ');
  const labelMatch = label.match(/(?:^|\D)(\d{1,4})\s*g(?:\D|$)/i);
  if (labelMatch) return Number(labelMatch[1]);

  const unitPrice = money(item.price);
  const priceMatches = tiers.filter(
    (tier) => tier.weightGrams != null && tier.weightGrams > 0 && tier.price === unitPrice,
  );
  return priceMatches.length === 1 ? priceMatches[0].weightGrams : null;
}

/** Shopify 結帳內收取的運費屬於本張訂單，不能標成「已在別處付費」。 */
export function shopifyShippingFeeType(shippingFee: number) {
  return shippingFee > 0 ? 'unpaid' : 'free';
}

async function findOrCreateCustomer(tx: DbClient, order: ShopifyPaidOrder) {
  const email = clean(order.email) ?? clean(order.customer?.email);
  const phone = clean(order.shipping_address?.phone) ?? clean(order.phone) ?? clean(order.customer?.phone);
  const identity = [email ? { email } : undefined, phone ? { phone } : undefined].filter(
    Boolean,
  ) as Prisma.CustomerWhereInput[];
  const existing = identity.length
    ? await tx.customer.findFirst({
        where: { OR: identity },
        orderBy: { createdAt: 'asc' },
      })
    : null;
  if (existing) return existing;

  const ids = await tx.customer.findMany({ select: { customerId: true } });
  return tx.customer.create({
    data: {
      customerId: formatCustomerId(maxCustomerIdSeq(ids.map((row) => row.customerId)) + 1),
      name: fullName(order),
      email,
      phone,
      address: addressText(order),
      preferredShippingMethod: isConveniencePickup(order) ? 'convenience' : 'home',
      preferredCvsBrand: isConveniencePickup(order) ? '711' : null,
      preferredCvsStoreName: isConveniencePickup(order)
        ? clean(order.shipping_address?.company) ?? clean(order.shipping_address?.address1)
        : null,
      notes: '由 Shopify 已付款 webhook 建立',
    },
  });
}

function internalOrderNumber(order: ShopifyPaidOrder): string {
  const visible = order.order_number ?? clean(order.name)?.replace(/^#/, '') ?? 'ORDER';
  const suffix = String(order.id).replace(/\D/g, '').slice(-6);
  return `SHOP-${visible}-${suffix}`;
}

export async function importShopifyOrder(
  shopDomain: string,
  order: ShopifyPaidOrder,
) {
  validateShopifyOrderPayload(order);
  const externalStore = shopDomain.trim().toLowerCase();
  if (!externalStore) throw new Error('缺少 Shopify shop domain');
  const externalOrderId = String(order.id);

  const existing = await prisma.order.findUnique({
    where: { externalStore_externalOrderId: { externalStore, externalOrderId } },
  });
  if (existing) {
    const nextPaymentStatus = paymentStatus(order.financial_status);
    const pickup = shopifyPickupInfo(order);
    const convenience = isConveniencePickup(order);
    const pickupUpdate = convenience
      ? {
          shippingMethod: 'convenience',
          shippingAddress: convenienceAddress(order),
          cvsBrand: pickup.brand,
          cvsStoreId: pickup.storeId,
          cvsStoreName: pickup.storeName,
        }
      : {};
    const pickupChanged = convenience && (
      existing.shippingMethod !== 'convenience' ||
      existing.shippingAddress !== convenienceAddress(order) ||
      existing.cvsBrand !== pickup.brand ||
      existing.cvsStoreId !== pickup.storeId ||
      existing.cvsStoreName !== pickup.storeName
    );
    if (existing.paymentStatus === nextPaymentStatus && !pickupChanged) {
      return { order: existing, created: false as const, updated: false as const };
    }
    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: { paymentStatus: nextPaymentStatus, ...pickupUpdate },
    });
    return { order: updated, created: false as const, updated: true as const };
  }

  return prisma.$transaction(async (tx) => {
    const skus = [...new Set((order.line_items ?? []).map((item) => clean(item.sku) as string))];
    const products = await tx.product.findMany({
      where: { OR: [{ sku: { in: skus } }, { sourceSku: { in: skus } }] },
      include: { priceTiers: { select: { weightGrams: true, price: true } } },
    });
    const bySku = new Map(
      products.flatMap((product) =>
        [product.sku, product.sourceSku]
          .filter((value): value is string => Boolean(value))
          .map((value) => [value, product] as const),
      ),
    );
    const missing = skus.filter((sku) => !bySku.has(sku));
    if (missing.length) throw new Error(`Furmosa 找不到 Shopify SKU：${missing.join(', ')}`);

    const customer = await findOrCreateCustomer(tx, order);
    const subtotal = money(order.subtotal_price);
    const discount = money(order.total_discounts);
    const shippingFee = money(order.total_shipping_price_set?.shop_money?.amount);
    const total = money(order.total_price);
    const convenience = isConveniencePickup(order);
    const pickup = shopifyPickupInfo(order);

    const created = await tx.order.create({
      data: {
        orderNumber: internalOrderNumber(order),
        source: 'shopify',
        externalStore,
        externalOrderId,
        externalOrderName: clean(order.name),
        status: 'pending_review',
        paymentStatus: paymentStatus(order.financial_status),
        fulfillmentStatus: 'pending',
        shippingFeeType: shopifyShippingFeeType(shippingFee),
        customerId: customer.id,
        subtotal,
        discount,
        shippingFee,
        companyShippingCost: shippingFee > 0 ? 0 : shippingFee,
        total,
        shippingMethod: convenience ? 'convenience' : 'home',
        shippingAddress: convenience ? convenienceAddress(order) : addressText(order),
        cvsBrand: convenience ? pickup.brand ?? '711' : null,
        cvsStoreId: convenience ? pickup.storeId : null,
        cvsStoreName: convenience
          ? pickup.storeName ?? clean(order.shipping_address?.company) ?? clean(order.shipping_address?.address1)
          : null,
        note: `Shopify ${clean(order.name) ?? externalOrderId}\n訂單已同步，${convenience && !hasCompleteShopifyPickupInfo(order) ? '門市資料待確認' : '待客服審核'}`,
        orderedAt: new Date(order.processed_at ?? order.created_at ?? Date.now()),
        items: {
          create: (order.line_items ?? []).map((item) => {
            const sku = clean(item.sku) as string;
            const product = bySku.get(sku)!;
            const quantity = Number(item.quantity);
            const unitPrice = money(item.price);
            const weightGrams = resolveShopifyItemWeight(item, product.priceTiers);
            return {
              productId: product.id,
              productName: [clean(item.title), clean(item.variant_title)].filter(Boolean).join(' · ') || product.name,
              sku,
              quantity,
              unitPrice,
              subtotal: unitPrice * quantity,
              weightGrams,
              unit: weightGrams ? 'g' : product.unit,
            };
          }),
        },
      },
    });

    await tx.statusAuditLog.create({
      data: {
        entityType: 'order',
        entityId: created.id,
        previousStatus: null,
        newStatus: 'pending_review',
        actorType: 'payment',
        metadataJson: JSON.stringify({ shopDomain: externalStore, externalOrderId }),
      },
    });

    return { order: created, created: true as const, updated: false as const };
  });
}

export async function importShopifyPaidOrder(
  shopDomain: string,
  order: ShopifyPaidOrder,
) {
  validatePaidOrderPayload(order);
  return importShopifyOrder(shopDomain, order);
}
