import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveCouponStoreForMerchant } from '@/lib/coupons/merchant-store-access';
import { getRefillPlanSettings } from '@/lib/jar-exchange/refill-flavours';

export type MerchantRefillTransaction = {
  id: string;
  occurredAt: string;
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
    availableStock: number;
  };
  inventory: Array<{
    id: string;
    name: string;
    weightGrams: number;
    quantity: number;
    isAvailable: boolean;
  }>;
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
    summary: { today: 0, thisMonth: 0, availableStock: 0 },
    inventory: [],
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
  const todayKey = taipeiDateKey(now);
  const monthKey = taipeiMonthKey(now);
  const todayStartedAt = new Date(`${todayKey}T00:00:00+08:00`);
  const monthStartedAt = new Date(`${monthKey}-01T00:00:00+08:00`);

  const [stocks, codes, todayCount, monthCount] = await Promise.all([
    prisma.merchantRefillStock.findMany({
      where: { storeId: store.id },
      orderBy: [{ isAvailable: 'desc' }, { flavour: { sortOrder: 'asc' } }],
      select: {
        id: true,
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
      where: { AND: [where, { redeemedAt: { gte: todayStartedAt } }] },
    }),
    prisma.jarCode.count({
      where: { AND: [where, { redeemedAt: { gte: monthStartedAt } }] },
    }),
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
      availableStock: stocks
        .filter((stock) => stock.isAvailable)
        .reduce((sum, stock) => sum + stock.quantity, 0),
    },
    inventory: stocks.map((stock) => ({
      id: stock.id,
      name: stock.flavour.name,
      weightGrams: stock.flavour.weightGrams,
      quantity: stock.quantity,
      isAvailable: stock.isAvailable,
    })),
    transactions: codes.map((row) => ({
      id: row.id,
      occurredAt: row.redeemedAt!.toISOString(),
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
