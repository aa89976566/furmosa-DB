import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isJarExchangeProductCategory } from '@/lib/product-category';

type DbClient = Prisma.TransactionClient | typeof prisma;

export type JarExchangeLineInput = {
  productCategory?: string | null;
  productId?: string | null;
  productName?: string | null;
};

/** True when every line is a JAR_EXCHANGE product (by productCategory only). */
export function isJarExchangeProductLine(line: JarExchangeLineInput): boolean {
  return isJarExchangeProductCategory(line.productCategory);
}

/** 寄賣店家補貨（換罐商品到店、無終端客戶）— 不計入營收 */
export function isJarExchangeConsignmentDelivery(input: {
  orderType?: string;
  source?: string;
  merchantId?: string | null;
  customerId?: string | null;
  items: JarExchangeLineInput[];
}): boolean {
  const isMerchantRestock =
    input.orderType === 'merchant' || (input.source === 'consignment' && !!input.merchantId);
  if (!isMerchantRestock || input.customerId) return false;
  if (input.items.length === 0) return false;
  return input.items.every((it) => isJarExchangeProductLine(it));
}

/** 換罐寄賣補貨：金額歸零、標註備註（出貨仍照常） */
export function applyJarExchangeConsignmentPricing<
  T extends {
    orderType: string;
    source: string;
    merchantId: string | null;
    customerId: string | null;
    items: {
      productCategory?: string | null;
      productId?: string | null;
      productName: string;
      unitPrice: number;
      lineSubtotal: number;
    }[];
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

/** Attach productCategory onto order lines (single source of truth for jar checks). */
export async function enrichOrderLinesWithProductCategory<
  T extends { productId: string },
>(items: T[], db: DbClient = prisma): Promise<(T & { productCategory: string })[]> {
  if (items.length === 0) return [];
  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, productCategory: true },
  });
  const byId = new Map(products.map((p) => [p.id, p.productCategory]));
  return items.map((it) => ({
    ...it,
    productCategory: byId.get(it.productId) ?? 'STANDARD',
  }));
}

/** 寄賣店家進貨／補貨單（無終端客戶）— 不是對外銷售 */
export const merchantRestockOrderWhere: Prisma.OrderWhereInput = {
  source: 'consignment',
  merchantId: { not: null },
  customerId: null,
};

/** 訂單是否應計入營收 KPI（排除寄賣進貨／補貨，含運費） */
export const revenueEligibleOrderWhere: Prisma.OrderWhereInput = {
  status: { notIn: ['cancelled', 'draft'] },
  NOT: merchantRestockOrderWhere,
};

/** 今日訂單等「成交筆數」：有效銷售單，不含草稿／取消／寄賣進貨 */
export const dashboardSalesOrderWhere: Prisma.OrderWhereInput = {
  ...revenueEligibleOrderWhere,
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

/** 依序號關聯商品或換罐商品預設售價（只查 productCategory=JAR_EXCHANGE） */
export async function resolveJarCodeSaleUnitPrice(
  jarCode: { productId?: string | null; productSku: string | null },
  db: DbClient = prisma,
): Promise<{ unitPrice: number; productId: string | null; productName: string; sku: string }> {
  if (jarCode.productId) {
    const product = await db.product.findUnique({
      where: { id: jarCode.productId },
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
  if (jarCode.productSku) {
    const product = await db.product.findFirst({
      where: { sku: jarCode.productSku },
      select: { id: true, name: true, sku: true, price: true, productCategory: true },
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
    where: { productCategory: 'JAR_EXCHANGE', status: 'active' },
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

/** 客人存罐序號入點 → 記一筆換罐銷售收入（source=jar_exchange） */
export async function recordJarExchangeSaleOnRedeem(
  customerId: string,
  jarCodeId: string,
  code: string,
  db: DbClient = prisma,
) {
  const jarCode = await db.jarCode.findUnique({
    where: { id: jarCodeId },
    select: {
      id: true,
      code: true,
      productSku: true,
      productId: true,
      redeemedLocationId: true,
    },
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
    select: {
      signupStore: true,
      storeId: true,
      signupLocationId: true,
      storeName: true,
    },
  });
  const merchantId =
    jarCode.redeemedLocationId ?? customer?.signupLocationId ?? null;
  const storeLabel =
    customer?.storeName ?? customer?.signupStore ?? customer?.storeId ?? '會員';

  return db.order.create({
    data: {
      orderNumber,
      source: 'jar_exchange',
      status: 'completed',
      paymentStatus: 'paid',
      shippingFeeType: 'free',
      fulfillmentStatus: 'delivered',
      customerId,
      merchantId,
      subtotal: priceInfo.unitPrice,
      discount: 0,
      shippingFee: 0,
      companyShippingCost: 0,
      total: priceInfo.unitPrice,
      shippingMethod: 'delivery',
      note: `換罐序號 ${code} 存罐入帳（${storeLabel}）`,
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
