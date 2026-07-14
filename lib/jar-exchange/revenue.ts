import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type DbClient = Prisma.TransactionClient | typeof prisma;

/** 換罐計畫寄賣商品名稱前綴（寄賣到店 ≠ 已售出） */
export const JAR_EXCHANGE_PRODUCT_PREFIX = '換罐';

export function isJarExchangeProductName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.trim().startsWith(JAR_EXCHANGE_PRODUCT_PREFIX);
}

export function isJarExchangeProductLine(line: {
  productName?: string | null;
}): boolean {
  return isJarExchangeProductName(line.productName);
}

/** 寄賣店家補貨（換罐商品到店、無終端客戶）— 不計入營收 */
export function isJarExchangeConsignmentDelivery(input: {
  orderType?: string;
  source?: string;
  merchantId?: string | null;
  customerId?: string | null;
  items: { productName: string }[];
}): boolean {
  const isMerchantRestock =
    input.orderType === 'merchant' || (input.source === 'consignment' && !!input.merchantId);
  if (!isMerchantRestock || input.customerId) return false;
  if (input.items.length === 0) return false;
  return input.items.every((it) => isJarExchangeProductName(it.productName));
}

/** 換罐寄賣補貨：金額歸零、標註備註（出貨仍照常） */
export function applyJarExchangeConsignmentPricing<
  T extends {
    orderType: string;
    source: string;
    merchantId: string | null;
    customerId: string | null;
    items: { productName: string; unitPrice: number; lineSubtotal: number }[];
    subtotal: number;
    discount: number;
    shippingFee: number;
    total: number;
    note: string | null;
  },
>(payload: T): T {
  if (
    !isJarExchangeConsignmentDelivery({
      orderType: payload.orderType,
      source: payload.source,
      merchantId: payload.merchantId,
      customerId: payload.customerId,
      items: payload.items,
    })
  ) {
    return payload;
  }

  const items = payload.items.map((it) => ({
    ...it,
    unitPrice: 0,
    lineSubtotal: 0,
  }));
  const note = payload.note
    ? `${payload.note} · 換罐計畫寄賣補貨（不計營收）`
    : '換罐計畫寄賣補貨（不計營收）';

  return {
    ...payload,
    items,
    subtotal: 0,
    discount: 0,
    shippingFee: 0,
    total: 0,
    note,
  };
}

/** 訂單是否應計入營收 KPI（排除換罐寄賣補貨） */
export const revenueEligibleOrderWhere: Prisma.OrderWhereInput = {
  NOT: {
    AND: [
      { source: 'consignment' },
      { merchantId: { not: null } },
      { customerId: null },
      {
        items: {
          every: {
            productName: { startsWith: JAR_EXCHANGE_PRODUCT_PREFIX },
          },
        },
      },
    ],
  },
};

export function mergeRevenueEligibleWhere(
  base: Prisma.OrderWhereInput,
): Prisma.OrderWhereInput {
  return { AND: [base, revenueEligibleOrderWhere] };
}

const pad = (n: number, width = 3) => String(n).padStart(width, '0');

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function nextJarSaleOrderNumber(db: DbClient = prisma) {
  const prefix = `ORD-${ymd()}-`;
  const last = await db.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
  });
  const seq = last ? Number(last.orderNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 3)}`;
}

/** 依序號關聯 SKU 或換罐商品預設售價 */
export async function resolveJarCodeSaleUnitPrice(
  jarCode: { productSku: string | null },
  db: DbClient = prisma,
): Promise<{ unitPrice: number; productId: string | null; productName: string; sku: string }> {
  if (jarCode.productSku) {
    const product = await db.product.findFirst({
      where: { sku: jarCode.productSku },
      select: { id: true, name: true, sku: true, price: true },
    });
    if (product) {
      return {
        unitPrice: Number(product.price),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
      };
    }
  }

  const fallback = await db.product.findFirst({
    where: { name: { startsWith: JAR_EXCHANGE_PRODUCT_PREFIX } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, sku: true, price: true },
  });
  if (fallback) {
    return {
      unitPrice: Number(fallback.price),
      productId: fallback.id,
      productName: fallback.name,
      sku: fallback.sku,
    };
  }

  return {
    unitPrice: 0,
    productId: null,
    productName: '換罐商品',
    sku: 'JAR',
  };
}

/** 客人輸入序號返航 → 記一筆換罐銷售收入（source=jar_exchange） */
export async function recordJarExchangeSaleOnRedeem(
  customerId: string,
  jarCodeId: string,
  code: string,
  db: DbClient = prisma,
) {
  const jarCode = await db.jarCode.findUnique({
    where: { id: jarCodeId },
    select: { id: true, code: true, productSku: true },
  });
  if (!jarCode) return null;

  const existing = await db.order.findFirst({
    where: { note: { contains: `換罐序號 ${code}` } },
    select: { id: true },
  });
  if (existing) return existing;

  const priceInfo = await resolveJarCodeSaleUnitPrice(jarCode, db);
  if (priceInfo.unitPrice <= 0 || !priceInfo.productId) return null;

  const orderNumber = await nextJarSaleOrderNumber(db);
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { signupStore: true, storeId: true },
  });

  return db.order.create({
    data: {
      orderNumber,
      source: 'jar_exchange',
      status: 'completed',
      paymentStatus: 'paid',
      shippingFeeType: 'free',
      fulfillmentStatus: 'delivered',
      customerId,
      merchantId: null,
      subtotal: priceInfo.unitPrice,
      discount: 0,
      shippingFee: 0,
      companyShippingCost: 0,
      total: priceInfo.unitPrice,
      shippingMethod: 'delivery',
      note: `換罐序號 ${code} 返航入帳（${customer?.signupStore ?? customer?.storeId ?? '會員'}）`,
      orderedAt: new Date(),
      completedAt: new Date(),
      items: {
        create: {
          productId: priceInfo.productId,
          productName: priceInfo.productName,
          sku: priceInfo.sku,
          quantity: 1,
          unitPrice: priceInfo.unitPrice,
          subtotal: priceInfo.unitPrice,
        },
      },
    },
  });
}
