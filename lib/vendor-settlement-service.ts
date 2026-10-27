import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { buildVendorSettlementDraft } from './vendor-settlement-draft';
import { VENDOR_SETTLEMENT_RULES_VERSION } from './vendor-settlement';

export type CreateVendorSettlementDraftInput = {
  vendorId: string;
  periodStart: Date;
  periodEnd: Date;
};

function periodKey(input: CreateVendorSettlementDraftInput) {
  return [
    VENDOR_SETTLEMENT_RULES_VERSION,
    input.vendorId,
    input.periodStart.toISOString(),
    input.periodEnd.toISOString(),
  ].join(':');
}

export function vendorSettlementIdentity(input: CreateVendorSettlementDraftInput) {
  const key = periodKey(input);
  const digest = createHash('sha256').update(key).digest('hex');
  const month = input.periodStart.toISOString().slice(0, 7).replace('-', '');
  return {
    idempotencyKey: `vendor-settlement:${digest}`,
    settlementNumber: `VSET-${month}-${digest.slice(0, 10).toUpperCase()}`,
  };
}

function assertPeriod(input: CreateVendorSettlementDraftInput) {
  if (!input.vendorId.trim()) throw new Error('缺少供應商');
  if (!Number.isFinite(input.periodStart.getTime()) || !Number.isFinite(input.periodEnd.getTime())) {
    throw new Error('對帳期間無效');
  }
  if (input.periodEnd <= input.periodStart) throw new Error('對帳結束時間必須晚於開始時間');
}

/**
 * Create one immutable draft per vendor/period/rules version.
 * No partial draft is written when any candidate order is unsafe to settle.
 */
export async function createVendorSettlementDraft(
  db: PrismaClient,
  input: CreateVendorSettlementDraftInput,
) {
  assertPeriod(input);
  const identity = vendorSettlementIdentity(input);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity.idempotencyKey}, 0))`;

    const existing = await tx.vendorSettlement.findUnique({
      where: { idempotencyKey: identity.idempotencyKey },
      include: { items: true },
    });
    if (existing) return { created: false as const, settlement: existing };

    const vendor = await tx.vendor.findUnique({
      where: { id: input.vendorId },
      select: {
        id: true,
        supplierConsignmentEnabled: true,
        furmosaShareBps: true,
        settlementCurrency: true,
      },
    });
    if (!vendor?.supplierConsignmentEnabled || vendor.furmosaShareBps == null) {
      throw new Error('此供應商尚未啟用寄賣分潤');
    }
    if (vendor.settlementCurrency !== 'TWD') throw new Error('目前只支援新台幣供應商對帳');

    const orders = await tx.order.findMany({
      where: {
        orderedAt: { gte: input.periodStart, lt: input.periodEnd },
        items: { some: { supplierVendorIdSnapshot: input.vendorId } },
      },
      select: {
        id: true,
        orderNumber: true,
        orderedAt: true,
        paymentStatus: true,
        status: true,
        subtotal: true,
        discount: true,
        items: {
          select: {
            id: true,
            productName: true,
            sku: true,
            quantity: true,
            weightGrams: true,
            unit: true,
            subtotal: true,
            isGift: true,
            supplierVendorIdSnapshot: true,
            supplierFurmosaShareBpsSnapshot: true,
          },
        },
      },
      orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }],
    });

    const draft = buildVendorSettlementDraft(input.vendorId, orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      orderedAt: order.orderedAt,
      paymentStatus: order.paymentStatus,
      status: order.status,
      subtotalTwd: Number(order.subtotal),
      discountTwd: Number(order.discount),
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        weightGrams: item.weightGrams,
        unit: item.unit,
        subtotalTwd: Number(item.subtotal),
        isGift: item.isGift,
        supplierVendorIdSnapshot: item.supplierVendorIdSnapshot,
        supplierFurmosaShareBpsSnapshot: item.supplierFurmosaShareBpsSnapshot,
      })),
    })));

    if (draft.blockers.length) {
      throw new Error(`供應商對帳尚不能建立：${draft.blockers.join('；')}`);
    }
    if (!draft.lines.length) throw new Error('此期間沒有可結算的供應商銷售');

    const sourceKeys = draft.lines.map((line) => line.sourceKey);
    const recognized = await tx.vendorSettlementItem.findFirst({
      where: { sourceKey: { in: sourceKeys }, voidedAt: null },
      select: { sourceKey: true },
    });
    if (recognized) throw new Error('部分銷售已存在其他供應商對帳，已停止避免重複結算');

    const totals = draft.lines.reduce((sum, line) => ({
      grossCollectedTwd: sum.grossCollectedTwd + line.grossCollectedTwd,
      refundTwd: sum.refundTwd + line.refundTwd,
      furmosaShareTwd: sum.furmosaShareTwd + line.furmosaShareTwd,
      vendorPayableTwd: sum.vendorPayableTwd + line.vendorPayableTwd,
    }), { grossCollectedTwd: 0, refundTwd: 0, furmosaShareTwd: 0, vendorPayableTwd: 0 });

    const settlement = await tx.vendorSettlement.create({
      data: {
        settlementNumber: identity.settlementNumber,
        vendorId: input.vendorId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        ...totals,
        status: 'draft',
        rulesVersion: VENDOR_SETTLEMENT_RULES_VERSION,
        idempotencyKey: identity.idempotencyKey,
        items: {
          create: draft.lines.map((line) => ({
            orderItemId: line.orderItemId,
            sourceKind: 'sale',
            sourceKey: line.sourceKey,
            grossCollectedTwd: line.grossCollectedTwd,
            refundTwd: line.refundTwd,
            furmosaShareBps: line.furmosaShareBps,
            furmosaShareTwd: line.furmosaShareTwd,
            vendorPayableTwd: line.vendorPayableTwd,
            occurredAt: line.occurredAt,
            sourceSnapshot: line.sourceSnapshot as Prisma.InputJsonValue,
            rulesVersion: VENDOR_SETTLEMENT_RULES_VERSION,
          })),
        },
      },
      include: { items: true },
    });
    return { created: true as const, settlement };
  }, { maxWait: 5_000, timeout: 15_000 });
}
