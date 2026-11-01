import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveCouponStoreForMerchant } from '@/lib/coupons/merchant-store-access';
import { getRefillPlanSettings } from '@/lib/jar-exchange/refill-flavours';
import { listMerchantRefillOrders } from '@/lib/refill/merchant';

export type MerchantRefillTransaction = {
  id: string;
  occurredAt: string;
  occurredAtLabel: string;
  customerName: string;
  petName: string | null;
  codeMasked: string;
  productName: string;
  points: number;
};

export type MerchantRefillDashboard = {
  storeReady: boolean;
  storeName: string;
  plan: {
    pointsPerJar: number;
    pointsForDiscount: number;
    discountAmount: number;
    exchangePrice: number;
    flavourUpdateNote: string;
  };
  summary: {
    today: number;
    thisMonth: number;
    last30Days: number;
    availableStock: number;
    todayLabel: string;
    monthLabel: string;
    updatedAtLabel: string;
  };
  inventory: Array<{
    id: string;
    flavourId: string;
    name: string;
    weightGrams: number;
    quantity: number;
    isAvailable: boolean;
  }>;
  pendingOrders: Awaited<ReturnType<typeof listMerchantRefillOrders>>;
  transactions: MerchantRefillTransaction[];
};

export function maskJarCode(code: string): string {
  return `•••• ${code.slice(-4)}`;
}

function taipeiDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function taipeiMonthKey(date: Date): string {
  return taipeiDateKey(date).slice(0, 7);
}

function taipeiDateTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function buildTaipeiRefillSummaryRange(now: Date = new Date()) {
  const todayKey = taipeiDateKey(now);
  const monthKey = taipeiMonthKey(now);
  return {
    todayStartedAt: new Date(`${todayKey}T00:00:00+08:00`),
    monthStartedAt: new Date(`${monthKey}-01T00:00:00+08:00`),
    last30DaysStartedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    todayLabel: new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      month: '2-digit',
      day: '2-digit',
    }).format(now),
    monthLabel: new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      month: 'numeric',
    }).format(now),
    updatedAtLabel: taipeiDateTimeLabel(now),
  };
}

export async function loadMerchantRefillDashboard(
  merchantId: string,
): Promise<MerchantRefillDashboard> {
  const [storeAccess, settings] = await Promise.all([
    resolveCouponStoreForMerchant(merchantId),
    getRefillPlanSettings(),
  ]);
  const empty: MerchantRefillDashboard = {
    storeReady: false,
    storeName: '',
    plan: {
      pointsPerJar: settings.pointsPerJar,
      pointsForDiscount: settings.pointsForDiscount,
      discountAmount: settings.discountAmount,
      exchangePrice: settings.exchangePrice,
      flavourUpdateNote: settings.flavourUpdateNote,
    },
    summary: {
      today: 0,
      thisMonth: 0,
      last30Days: 0,
      availableStock: 0,
      todayLabel: '',
      monthLabel: '',
      updatedAtLabel: '',
    },
    inventory: [],
    pendingOrders: [],
    transactions: [],
  };
  if (!storeAccess) return empty;

  const store = await prisma.store.findUnique({
    where: { slug: storeAccess.storeSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!store) return { ...empty, storeName: storeAccess.storeName };

  const customerStoreKeys = [store.id, store.slug, storeAccess.merchantCode];
  const customerFallback: Prisma.JarCodeWhereInput = {
    returnedMerchantId: null,
    issuedMerchantId: null,
    redeemedByCustomer: {
      is: {
        OR: [
          { storeId: { in: customerStoreKeys } },
          { signupStore: { in: customerStoreKeys } },
          { storeName: { equals: store.name, mode: 'insensitive' } },
        ],
      },
    },
  };
  const where: Prisma.JarCodeWhereInput = {
    status: 'used',
    redeemedAt: { not: null },
    OR: [
      { returnedMerchantId: merchantId },
      { issuedMerchantId: merchantId },
      customerFallback,
    ],
  };
  const now = new Date();
  const range = buildTaipeiRefillSummaryRange(now);

  const [stocks, codes, todayCount, monthCount, last30DaysCount, orders] = await Promise.all([
    prisma.merchantRefillStock.findMany({
      where: { storeId: store.id },
      orderBy: [{ isAvailable: 'desc' }, { flavour: { sortOrder: 'asc' } }],
      select: {
        id: true,
        flavourId: true,
        quantity: true,
        isAvailable: true,
        flavour: { select: { name: true, weightGrams: true } },
      },
    }),
    prisma.jarCode.findMany({
      where,
      orderBy: { redeemedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        code: true,
        productSku: true,
        pointValue: true,
        redeemedAt: true,
        redeemedByCustomer: { select: { name: true, petName: true } },
      },
    }),
    prisma.jarCode.count({
      where: { AND: [where, { redeemedAt: { gte: range.todayStartedAt } }] },
    }),
    prisma.jarCode.count({
      where: { AND: [where, { redeemedAt: { gte: range.monthStartedAt } }] },
    }),
    prisma.jarCode.count({
      where: { AND: [where, { redeemedAt: { gte: range.last30DaysStartedAt } }] },
    }),
    listMerchantRefillOrders(merchantId),
  ]);

  const skus = [...new Set(codes.map((row) => row.productSku).filter(Boolean))] as string[];
  const products = skus.length
    ? await prisma.product.findMany({
        where: { sku: { in: skus } },
        select: { sku: true, name: true },
      })
    : [];
  const productNames = new Map(products.map((product) => [product.sku, product.name]));
  return {
    storeReady: true,
    storeName: store.name,
    plan: empty.plan,
    summary: {
      today: todayCount,
      thisMonth: monthCount,
      last30Days: last30DaysCount,
      availableStock: stocks
        .filter((stock) => stock.isAvailable)
        .reduce((sum, stock) => sum + stock.quantity, 0),
      todayLabel: range.todayLabel,
      monthLabel: range.monthLabel,
      updatedAtLabel: range.updatedAtLabel,
    },
    inventory: stocks.map((stock) => ({
      id: stock.id,
      flavourId: stock.flavourId,
      name: stock.flavour.name,
      weightGrams: stock.flavour.weightGrams,
      quantity: stock.quantity,
      isAvailable: stock.isAvailable,
    })),
    pendingOrders: orders.filter((order) => order.paid && order.status !== 'completed'),
    transactions: codes.map((row) => ({
      id: row.id,
      occurredAt: row.redeemedAt!.toISOString(),
      occurredAtLabel: taipeiDateTimeLabel(row.redeemedAt!),
      customerName: row.redeemedByCustomer?.name ?? 'LINE 會員',
      petName: row.redeemedByCustomer?.petName ?? null,
      codeMasked: maskJarCode(row.code),
      productName: row.productSku
        ? productNames.get(row.productSku) ?? row.productSku
        : '換罐序號',
      points: row.pointValue,
    })),
  };
}
