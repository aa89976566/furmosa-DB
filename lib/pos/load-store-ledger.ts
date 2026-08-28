import { prisma } from '@/lib/prisma';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';
import { formatRefillOrderNo } from '@/lib/pos/refill-view';
import { storeHeading } from '@/lib/pos/store-display';
import {
  authoritativeGroomingCouponStoreIds,
  projectSubsidyFactsToLedgerEntries,
} from '@/lib/pos/project-store-ledger-sources';
import {
  classifyPaymentOrder,
  classifyRestockCost,
  classifyUnpaidRefill,
  groupRefillReconciliations,
  sortLedgerEntries,
  summarizeStoreLedger,
  toLedgerEntryView,
  type LedgerEntry,
  type LedgerEntryView,
  type StoreLedgerSummary,
} from '@/lib/pos/store-ledger';

const BILLABLE_RESTOCK_STATUSES = ['approved', 'converted_to_shipment'] as const;

export type StoreLedgerPageData = {
  storeId: string;
  storeLabel: string;
  periodStart: string;
  periodEnd: string;
  summary: StoreLedgerSummary;
  entries: LedgerEntryView[];
  refillRows: ReturnType<typeof groupRefillReconciliations>;
  persistAvailable: false;
  amountNotes: string[];
};

type LoadOptions = {
  merchantId: string;
  periodStart: Date;
  periodEnd: Date;
};

function paidPayment(status: string, paidAt: Date | null): boolean {
  return status === 'paid' && paidAt != null;
}

export async function loadStoreLedgerPageData(options: LoadOptions): Promise<StoreLedgerPageData> {
  const { entries, summary, amountNotes, storeLabel, storeId } = await loadStoreLedger(options);
  return {
    storeId,
    storeLabel,
    periodStart: options.periodStart.toISOString(),
    periodEnd: options.periodEnd.toISOString(),
    summary,
    entries: sortLedgerEntries(entries).map(toLedgerEntryView),
    refillRows: groupRefillReconciliations(entries),
    persistAvailable: false,
    amountNotes,
  };
}

export async function loadStoreLedger(options: LoadOptions): Promise<{
  storeId: string;
  storeLabel: string;
  entries: LedgerEntry[];
  summary: StoreLedgerSummary;
  amountNotes: string[];
}> {
  const merchant = await prisma.merchant.findFirst({
    where: { id: options.merchantId },
    select: { id: true, merchantId: true, name: true, city: true },
  });
  if (!merchant) {
    return {
      storeId: options.merchantId,
      storeLabel: '店家',
      entries: [],
      summary: summarizeStoreLedger([]),
      amountNotes: [],
    };
  }

  const storeSlug = merchantToStoreSlug(merchant.merchantId);
  const heading = storeHeading({ name: merchant.name, city: merchant.city });
  const amountNotes: string[] = [];
  const store = await prisma.store.findUnique({
    where: { slug: storeSlug },
    select: { id: true, slug: true, name: true },
  });

  const [refillOrders, coupons, redemptions, restocks] = await Promise.all([
    prisma.refillOrder.findMany({
      where: {
        merchantId: merchant.id,
        status: { not: 'draft' },
        OR: [
          { createdAt: { gte: options.periodStart, lte: options.periodEnd } },
          { paidAt: { gte: options.periodStart, lte: options.periodEnd } },
          {
            payments: {
              some: { paidAt: { gte: options.periodStart, lte: options.periodEnd } },
            },
          },
        ],
      },
      select: {
        id: true,
        status: true,
        orderType: true,
        baseAmount: true,
        extraAmount: true,
        totalAmount: true,
        paidAt: true,
        createdAt: true,
        oldContainerSerial: true,
        newContainerSerial: true,
        customerId: true,
        customer: { select: { id: true, name: true } },
        payments: {
          select: {
            id: true,
            purpose: true,
            status: true,
            amount: true,
            provider: true,
            paidAt: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.groomingCoupon.findMany({
      where: {
        status: 'redeemed',
        redeemedAt: { gte: options.periodStart, lte: options.periodEnd },
        storeId: {
          in: authoritativeGroomingCouponStoreIds(
            { id: merchant.id, merchantId: merchant.merchantId, name: merchant.name },
            { id: store?.id ?? null, slug: storeSlug },
          ),
        },
      },
      select: {
        id: true,
        couponCode: true,
        discountAmount: true,
        redeemedAt: true,
        customerId: true,
        storeId: true,
        storeName: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.rewardRedemption.findMany({
      where: {
        partnerMerchantId: merchant.id,
        couponStatus: 'used',
        usedAt: { gte: options.periodStart, lte: options.periodEnd },
      },
      select: {
        id: true,
        couponCode: true,
        usedAt: true,
        customerId: true,
        partnerMerchantId: true,
        customer: { select: { id: true, name: true } },
        reward: { select: { couponFaceValue: true } },
      },
    }),
    prisma.restockRequest.findMany({
      where: {
        merchantId: merchant.id,
        status: { in: [...BILLABLE_RESTOCK_STATUSES] },
        OR: [
          { approvedAt: { gte: options.periodStart, lte: options.periodEnd } },
          {
            approvedAt: null,
            createdAt: { gte: options.periodStart, lte: options.periodEnd },
          },
        ],
      },
      select: {
        id: true,
        approvedAt: true,
        createdAt: true,
        shipment: {
          select: {
            shipmentNumber: true,
            order: { select: { orderNumber: true } },
          },
        },
        items: {
          select: {
            requestedQuantity: true,
            approvedQuantity: true,
            product: { select: { name: true, cost: true } },
          },
        },
      },
    }),
  ]);

  const entries: LedgerEntry[] = [];

  for (const order of refillOrders) {
    const refillDisplay = formatRefillOrderNo(order.id, order.createdAt);
    const jarSerial = order.oldContainerSerial ?? order.newContainerSerial;
    const paidRefill =
      order.paidAt != null ||
      order.payments.some(
        (payment) => payment.purpose === 'refill' && paidPayment(payment.status, payment.paidAt),
      );
    const inPeriod = (date: Date | null) =>
      Boolean(date && date >= options.periodStart && date <= options.periodEnd);

    for (const payment of order.payments) {
      const occurred = payment.paidAt ?? payment.createdAt;
      if (!inPeriod(occurred)) continue;
      const purpose = payment.purpose === 'extra_topup' ? 'extra_topup' : 'refill';
      const entry = classifyPaymentOrder({
        id: payment.id,
        purpose,
        status: payment.status,
        amount: payment.amount,
        provider: payment.provider,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        refillOrderId: order.id,
        refillDisplay,
        refillOrderType: order.orderType,
        customerId: order.customerId,
        customerName: order.customer.name,
        jarSerial,
        storeId: merchant.id,
      });
      if (entry) entries.push(entry);
    }

    const unpaidLike =
      order.status === 'payment_pending' ||
      order.status === 'payment_failed' ||
      order.status === 'cancelled' ||
      order.status === 'expired' ||
      (!paidRefill && order.status !== 'completed');

    if (unpaidLike && !paidRefill && inPeriod(order.createdAt)) {
      entries.push(
        classifyUnpaidRefill({
          id: order.id,
          createdAt: order.createdAt,
          amount: order.baseAmount || order.totalAmount,
          refillDisplay,
          customerId: order.customerId,
          customerName: order.customer.name,
          jarSerial,
          storeId: merchant.id,
          paymentStatus:
            order.status === 'payment_failed'
              ? 'failed'
              : order.status === 'cancelled' || order.status === 'expired'
                ? 'cancelled'
                : 'pending',
        }),
      );
    }
  }

  entries.push(
    ...projectSubsidyFactsToLedgerEntries({
      merchant: { id: merchant.id, merchantId: merchant.merchantId, name: merchant.name },
      store: { id: store?.id ?? null, slug: storeSlug },
      coupons,
      redemptions,
    }),
  );

  let usedCostFallback = false;
  for (const restock of restocks) {
    const amount = restock.items.reduce((sum, item) => {
      const qty = item.approvedQuantity ?? item.requestedQuantity ?? 0;
      const cost = item.product.cost ?? 0;
      if (qty > 0 && cost <= 0) usedCostFallback = true;
      return sum + qty * cost;
    }, 0);
    const names = restock.items
      .map((item) => item.product.name)
      .filter(Boolean)
      .slice(0, 3)
      .join('、');
    const relatedOrderDisplay =
      restock.shipment?.order?.orderNumber ||
      restock.shipment?.shipmentNumber ||
      `補貨 ${restock.id.slice(-6).toUpperCase()}`;
    entries.push(
      classifyRestockCost({
        id: restock.id,
        occurredAt: restock.approvedAt ?? restock.createdAt,
        amount,
        relatedOrderId: restock.id,
        relatedOrderDisplay,
        storeId: merchant.id,
        content: names ? `補貨單 ${relatedOrderDisplay} ${names}` : `補貨單 ${relatedOrderDisplay}`,
      }),
    );
  }

  if (usedCostFallback) {
    amountNotes.push('部分進貨單沒有可靠單價，目前先用商品成本估算。');
  }
  amountNotes.push('忘帶空罐補差額目前是客人線上付給匠寵，不會算進店家應付。');
  amountNotes.push('10 點優惠券是獨立補貼流水，不會只在訂單總額上減掉。');

  return {
    storeId: merchant.id,
    storeLabel: heading.combined,
    entries,
    summary: summarizeStoreLedger(entries),
    amountNotes,
  };
}
