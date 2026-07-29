import { prisma } from '@/lib/prisma';
import {
  DEFAULT_REFILL_FLAVOURS,
  REFILL_PLAN_RULES,
  formatFlavourLabel,
} from '@/lib/jar-exchange/refill-plan-content';

export type RefillFlavourView = {
  id: string;
  code: string;
  name: string;
  weightGrams: number;
  imageUrl: string | null;
  isActive: boolean;
  availableFrom: Date | null;
  availableUntil: Date | null;
  sortOrder: number;
  label: string;
};

export type RefillPlanSettingsView = {
  heroImageUrl: string;
  firstJarPrice: number;
  exchangePrice: number;
  pointsPerJar: number;
  pointsForDiscount: number;
  discountAmount: number;
  flavourUpdateNote: string;
  periodStartedAt: Date | null;
  periodEndedAt: Date | null;
};

function fallbackFlavours(): RefillFlavourView[] {
  return DEFAULT_REFILL_FLAVOURS.map((f, i) => ({
    id: `fallback-${f.code}`,
    code: f.code,
    name: f.name,
    weightGrams: f.weightGrams,
    imageUrl: null,
    isActive: true,
    availableFrom: null,
    availableUntil: null,
    sortOrder: f.sortOrder,
    label: formatFlavourLabel(f.name, f.weightGrams),
  }));
}

function isWithinPeriod(now: Date, from: Date | null, until: Date | null): boolean {
  if (from && now < from) return false;
  if (until && now > until) return false;
  return true;
}

/** 確保設定列與七種口味存在（migrate 未跑時仍可顯示） */
export async function ensureRefillPlanSeeded(): Promise<void> {
  try {
    await prisma.refillPlanSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        heroImageUrl: REFILL_PLAN_RULES.heroImagePath,
        firstJarPrice: REFILL_PLAN_RULES.firstJarPrice,
        exchangePrice: REFILL_PLAN_RULES.exchangePrice,
        pointsPerJar: REFILL_PLAN_RULES.pointsPerJar,
        pointsForDiscount: REFILL_PLAN_RULES.pointsForDiscount,
        discountAmount: REFILL_PLAN_RULES.discountAmountDefault,
        flavourUpdateNote: REFILL_PLAN_RULES.flavourUpdateCadence,
        periodStartedAt: new Date(),
      },
      update: {},
    });

    for (const f of DEFAULT_REFILL_FLAVOURS) {
      await prisma.refillFlavour.upsert({
        where: { code: f.code },
        create: {
          code: f.code,
          name: f.name,
          weightGrams: f.weightGrams,
          isActive: true,
          sortOrder: f.sortOrder,
          availableFrom: new Date(),
        },
        update: {
          name: f.name,
          weightGrams: f.weightGrams,
          sortOrder: f.sortOrder,
        },
      });
    }
  } catch (err) {
    console.error('[refill-plan] ensure seed failed', err);
  }
}

export async function getRefillPlanSettings(): Promise<RefillPlanSettingsView> {
  try {
    await ensureRefillPlanSeeded();
    const row = await prisma.refillPlanSettings.findUnique({ where: { id: 'default' } });
    if (!row) {
      return {
        heroImageUrl: REFILL_PLAN_RULES.heroImagePath,
        firstJarPrice: REFILL_PLAN_RULES.firstJarPrice,
        exchangePrice: REFILL_PLAN_RULES.exchangePrice,
        pointsPerJar: REFILL_PLAN_RULES.pointsPerJar,
        pointsForDiscount: REFILL_PLAN_RULES.pointsForDiscount,
        discountAmount: REFILL_PLAN_RULES.discountAmountDefault,
        flavourUpdateNote: REFILL_PLAN_RULES.flavourUpdateCadence,
        periodStartedAt: null,
        periodEndedAt: null,
      };
    }
    return {
      heroImageUrl: row.heroImageUrl || REFILL_PLAN_RULES.heroImagePath,
      firstJarPrice: row.firstJarPrice,
      exchangePrice: row.exchangePrice,
      pointsPerJar: row.pointsPerJar,
      pointsForDiscount: row.pointsForDiscount,
      discountAmount: row.discountAmount,
      flavourUpdateNote: row.flavourUpdateNote,
      periodStartedAt: row.periodStartedAt,
      periodEndedAt: row.periodEndedAt,
    };
  } catch (err) {
    console.error('[refill-plan] get settings failed', err);
    return {
      heroImageUrl: REFILL_PLAN_RULES.heroImagePath,
      firstJarPrice: REFILL_PLAN_RULES.firstJarPrice,
      exchangePrice: REFILL_PLAN_RULES.exchangePrice,
      pointsPerJar: REFILL_PLAN_RULES.pointsPerJar,
      pointsForDiscount: REFILL_PLAN_RULES.pointsForDiscount,
      discountAmount: REFILL_PLAN_RULES.discountAmountDefault,
      flavourUpdateNote: REFILL_PLAN_RULES.flavourUpdateCadence,
      periodStartedAt: null,
      periodEndedAt: null,
    };
  }
}

/** 目前有效口味（isActive + 可選期間） */
export async function listActiveRefillFlavours(
  now: Date = new Date(),
): Promise<RefillFlavourView[]> {
  try {
    await ensureRefillPlanSeeded();
    const rows = await prisma.refillFlavour.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const filtered = rows
      .filter((r) => isWithinPeriod(now, r.availableFrom, r.availableUntil))
      .map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        weightGrams: r.weightGrams,
        imageUrl: r.imageUrl,
        isActive: r.isActive,
        availableFrom: r.availableFrom,
        availableUntil: r.availableUntil,
        sortOrder: r.sortOrder,
        label: formatFlavourLabel(r.name, r.weightGrams),
      }));
    return filtered.length > 0 ? filtered : fallbackFlavours();
  } catch (err) {
    console.error('[refill-plan] list flavours failed', err);
    return fallbackFlavours();
  }
}

/** 某合作店可選口味：active + quantity>0 + isAvailable */
export async function listStoreAvailableFlavours(
  storeId: string,
  now: Date = new Date(),
): Promise<RefillFlavourView[]> {
  try {
    await ensureRefillPlanSeeded();
    const stocks = await prisma.merchantRefillStock.findMany({
      where: {
        storeId,
        isAvailable: true,
        quantity: { gt: 0 },
        flavour: { isActive: true },
      },
      include: { flavour: true },
      orderBy: { flavour: { sortOrder: 'asc' } },
    });
    return stocks
      .filter((s) =>
        isWithinPeriod(now, s.flavour.availableFrom, s.flavour.availableUntil),
      )
      .map((s) => ({
        id: s.flavour.id,
        code: s.flavour.code,
        name: s.flavour.name,
        weightGrams: s.flavour.weightGrams,
        imageUrl: s.flavour.imageUrl,
        isActive: s.flavour.isActive,
        availableFrom: s.flavour.availableFrom,
        availableUntil: s.flavour.availableUntil,
        sortOrder: s.flavour.sortOrder,
        label: formatFlavourLabel(s.flavour.name, s.flavour.weightGrams),
      }));
  } catch (err) {
    console.error('[refill-plan] list store flavours failed', err);
    return [];
  }
}
