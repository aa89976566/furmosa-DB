import { Prisma } from '@prisma/client';
import { CASH_WEEK_COUNT, type FinanceChannel } from '@/lib/finance/channels';
import { emptyCashWeek, type CashWeekInput, type MarginThresholds } from '@/lib/finance/formula';
import { requireFinanceAdmin } from '@/lib/finance/guard';
import { taipeiMonday } from '@/lib/finance/calendar';
import { parseChannel, parseThresholds, parseTwdToCents } from '@/lib/finance/validate';

type AuditJson = Prisma.InputJsonObject;

export type FinanceWriteDb = {
  product: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; foodCostCents: true; packagingCostCents: true };
    }): Promise<{ id: string; foodCostCents: number | null; packagingCostCents: number | null } | null>;
    update(args: {
      where: { id: string };
      data: { foodCostCents: number | null; packagingCostCents: number | null };
    }): Promise<unknown>;
  };
  financeMarginSettings: {
    findUnique(args: { where: { id: string } }): Promise<{ greenMinBps: number; yellowMinBps: number } | null>;
    upsert(args: {
      where: { id: string };
      create: { id: string; greenMinBps: number; yellowMinBps: number; updatedByUserId: string };
      update: { greenMinBps: number; yellowMinBps: number; updatedByUserId: string };
    }): Promise<unknown>;
  };
  financeSkuChannelCost: {
    findUnique(args: {
      where: { productId_channel: { productId: string; channel: string } };
    }): Promise<Record<string, unknown> | null>;
    upsert(args: {
      where: { productId_channel: { productId: string; channel: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
  financeCashPlan: {
    findUnique(args: { where: { id: string }; include: { weeks: true } }): Promise<{
      openingBalanceCents: number | null;
      minimumCashCents: number | null;
      weeks: Array<CashWeekInput & { weekIndex: number }>;
    } | null>;
    upsert(args: {
      where: { id: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
  financeCashWeek: {
    deleteMany(args: { where: { planId: string } }): Promise<unknown>;
    createMany(args: { data: Array<Record<string, unknown>> }): Promise<unknown>;
  };
  financeAuditLog: {
    create(args: {
      data: {
        actorUserId: string;
        action: string;
        entityType: string;
        entityId: string;
        before: AuditJson | null;
        after: AuditJson;
      };
    }): Promise<unknown>;
  };
  $transaction<T>(fn: (tx: FinanceWriteDb) => Promise<T>): Promise<T>;
};

export type FinanceDeps = {
  requireFinanceAdmin: () => Promise<{ userId: string }>;
  db: FinanceWriteDb;
};

function centsField(raw: unknown, label: string) {
  const parsed = parseTwdToCents(raw);
  if (!parsed.ok) return { ok: false as const, message: `${label}：${parsed.message}` };
  return { ok: true as const, cents: parsed.cents };
}

export async function updateProductCosts(
  input: { productId: string; foodCost: unknown; packagingCost: unknown },
  deps: FinanceDeps,
) {
  const admin = await deps.requireFinanceAdmin();
  const productId = input.productId.trim();
  if (!productId) return { ok: false as const, message: '找不到商品。' };
  const food = centsField(input.foodCost, '食品成本');
  if (!food.ok) return food;
  const packaging = centsField(input.packagingCost, '包裝成本');
  if (!packaging.ok) return packaging;

  await deps.db.$transaction(async (tx) => {
    const current = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, foodCostCents: true, packagingCostCents: true },
    });
    if (!current) throw new Error('找不到商品');
    await tx.product.update({
      where: { id: productId },
      data: { foodCostCents: food.cents, packagingCostCents: packaging.cents },
    });
    await tx.financeAuditLog.create({
      data: {
        actorUserId: admin.userId,
        action: 'update_product_cost',
        entityType: 'product',
        entityId: productId,
        before: {
          foodCostCents: current.foodCostCents,
          packagingCostCents: current.packagingCostCents,
        },
        after: { foodCostCents: food.cents, packagingCostCents: packaging.cents },
      },
    });
  });
  return { ok: true as const };
}

export async function updateMarginThresholds(
  input: { green: unknown; yellow: unknown },
  deps: FinanceDeps,
) {
  const admin = await deps.requireFinanceAdmin();
  const parsed = parseThresholds(input.green, input.yellow);
  if (!parsed.ok) return parsed;
  const thresholds: MarginThresholds = parsed.thresholds;
  await deps.db.$transaction(async (tx) => {
    const current = await tx.financeMarginSettings.findUnique({ where: { id: 'default' } });
    await tx.financeMarginSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        greenMinBps: thresholds.greenMinBps,
        yellowMinBps: thresholds.yellowMinBps,
        updatedByUserId: admin.userId,
      },
      update: {
        greenMinBps: thresholds.greenMinBps,
        yellowMinBps: thresholds.yellowMinBps,
        updatedByUserId: admin.userId,
      },
    });
    await tx.financeAuditLog.create({
      data: {
        actorUserId: admin.userId,
        action: 'update_margin_thresholds',
        entityType: 'finance_margin_settings',
        entityId: 'default',
        before: current
          ? { greenMinBps: current.greenMinBps, yellowMinBps: current.yellowMinBps }
          : null,
        after: { greenMinBps: thresholds.greenMinBps, yellowMinBps: thresholds.yellowMinBps },
      },
    });
  });
  return { ok: true as const };
}

export async function updateChannelCost(
  input: {
    productId: string;
    channel: unknown;
    otherDirectCost: unknown;
    cleaning: unknown;
    transport: unknown;
    groupLeaderShare: unknown;
    centerShare: unknown;
  },
  deps: FinanceDeps,
) {
  const admin = await deps.requireFinanceAdmin();
  const channel = parseChannel(input.channel);
  const productId = input.productId.trim();
  if (!channel || !productId) return { ok: false as const, message: '通路或商品不正確。' };
  const other = centsField(input.otherDirectCost, '其他直接成本');
  if (!other.ok) return other;
  const refillFields =
    channel === 'refill'
      ? {
          cleaning: centsField(input.cleaning, '清洗'),
          transport: centsField(input.transport, '運輸'),
          leader: centsField(input.groupLeaderShare, '團主分潤'),
          center: centsField(input.centerShare, '中心店分潤'),
        }
      : null;
  if (refillFields) {
    for (const field of Object.values(refillFields)) {
      if (!field.ok) return field;
    }
  }
  const data = {
    otherDirectCostCents: other.cents,
    cleaningCents: refillFields?.cleaning.ok ? refillFields.cleaning.cents : null,
    transportCents: refillFields?.transport.ok ? refillFields.transport.cents : null,
    groupLeaderShareCents: refillFields?.leader.ok ? refillFields.leader.cents : null,
    centerShareCents: refillFields?.center.ok ? refillFields.center.cents : null,
    updatedByUserId: admin.userId,
  };
  await deps.db.$transaction(async (tx) => {
    const current = await tx.financeSkuChannelCost.findUnique({
      where: { productId_channel: { productId, channel } },
    });
    await tx.financeSkuChannelCost.upsert({
      where: { productId_channel: { productId, channel } },
      create: { productId, channel, ...data },
      update: data,
    });
    await tx.financeAuditLog.create({
      data: {
        actorUserId: admin.userId,
        action: 'update_channel_cost',
        entityType: 'finance_sku_channel_cost',
        entityId: `${productId}:${channel}`,
        before: current ? sanitizeChannelCost(current) : null,
        after: { channel: channel satisfies FinanceChannel, ...data },
      },
    });
  });
  return { ok: true as const };
}

function sanitizeChannelCost(row: Record<string, unknown>): AuditJson {
  return {
    otherDirectCostCents: numberOrNull(row.otherDirectCostCents),
    cleaningCents: numberOrNull(row.cleaningCents),
    transportCents: numberOrNull(row.transportCents),
    groupLeaderShareCents: numberOrNull(row.groupLeaderShareCents),
    centerShareCents: numberOrNull(row.centerShareCents),
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

export async function updateCashPlan(
  input: {
    openingBalance: unknown;
    minimumCash: unknown;
    weeks: Array<{
      inflow: unknown;
      supplierPayment: unknown;
      packaging: unknown;
      payroll: unknown;
      ads: unknown;
      logistics: unknown;
      sampling: unknown;
    }>;
  },
  deps: FinanceDeps,
) {
  const admin = await deps.requireFinanceAdmin();
  if (input.weeks.length !== CASH_WEEK_COUNT) {
    return { ok: false as const, message: '現金流必須剛好 13 週。' };
  }
  const opening = centsField(input.openingBalance, '現金餘額');
  if (!opening.ok) return opening;
  const minimum = centsField(input.minimumCash, '最低現金點');
  if (!minimum.ok) return minimum;
  const weeks: CashWeekInput[] = [];
  for (let index = 0; index < input.weeks.length; index += 1) {
    const week = input.weeks[index] ?? emptyCashWeek();
    const parsed = {
      inflowCents: centsField(week.inflow, `第 ${index + 1} 週進帳`),
      supplierPaymentCents: centsField(week.supplierPayment, `第 ${index + 1} 週供應商付款`),
      packagingCents: centsField(week.packaging, `第 ${index + 1} 週包材`),
      payrollCents: centsField(week.payroll, `第 ${index + 1} 週薪資`),
      adsCents: centsField(week.ads, `第 ${index + 1} 週廣告`),
      logisticsCents: centsField(week.logistics, `第 ${index + 1} 週物流`),
      samplingCents: centsField(week.sampling, `第 ${index + 1} 週新品打樣`),
    };
    for (const field of Object.values(parsed)) {
      if (!field.ok) return field;
    }
    weeks.push({
      inflowCents: parsed.inflowCents.ok ? parsed.inflowCents.cents : null,
      supplierPaymentCents: parsed.supplierPaymentCents.ok ? parsed.supplierPaymentCents.cents : null,
      packagingCents: parsed.packagingCents.ok ? parsed.packagingCents.cents : null,
      payrollCents: parsed.payrollCents.ok ? parsed.payrollCents.cents : null,
      adsCents: parsed.adsCents.ok ? parsed.adsCents.cents : null,
      logisticsCents: parsed.logisticsCents.ok ? parsed.logisticsCents.cents : null,
      samplingCents: parsed.samplingCents.ok ? parsed.samplingCents.cents : null,
    });
  }

  await deps.db.$transaction(async (tx) => {
    const current = await tx.financeCashPlan.findUnique({
      where: { id: 'default' },
      include: { weeks: true },
    });
    const plan = await tx.financeCashPlan.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        openingBalanceCents: opening.cents,
        minimumCashCents: minimum.cents,
        anchorMonday: new Date(`${taipeiMonday()}T00:00:00.000Z`),
        updatedByUserId: admin.userId,
      },
      update: {
        openingBalanceCents: opening.cents,
        minimumCashCents: minimum.cents,
        updatedByUserId: admin.userId,
      },
    });
    await tx.financeCashWeek.deleteMany({ where: { planId: plan.id } });
    await tx.financeCashWeek.createMany({
      data: weeks.map((week, weekIndex) => ({
        planId: plan.id,
        weekIndex,
        ...week,
        updatedByUserId: admin.userId,
      })),
    });
    await tx.financeAuditLog.create({
      data: {
        actorUserId: admin.userId,
        action: 'update_cash_plan',
        entityType: 'finance_cash_plan',
        entityId: 'default',
        before: current
          ? {
              openingBalanceCents: current.openingBalanceCents,
              minimumCashCents: current.minimumCashCents,
              weeks: current.weeks.map((week) => ({
                weekIndex: week.weekIndex,
                inflowCents: week.inflowCents,
                supplierPaymentCents: week.supplierPaymentCents,
                packagingCents: week.packagingCents,
                payrollCents: week.payrollCents,
                adsCents: week.adsCents,
                logisticsCents: week.logisticsCents,
                samplingCents: week.samplingCents,
              })),
            }
          : null,
        after: {
          openingBalanceCents: opening.cents,
          minimumCashCents: minimum.cents,
          weeks: weeks.map((week, weekIndex) => ({ weekIndex, ...week })),
        },
      },
    });
  });
  return { ok: true as const };
}

export async function productionFinanceDeps(): Promise<FinanceDeps> {
  const { prisma } = await import('@/lib/prisma');
  return {
    requireFinanceAdmin,
    db: prisma as unknown as FinanceWriteDb,
  };
}
