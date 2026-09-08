import { prisma } from '@/lib/prisma';
import { APP_STATUS } from '@/lib/campaigns/jiba-two-piece/constants';
import { isMissingCampaignTableError } from '@/lib/campaigns/jiba-two-piece/missing-table';
import { activeOrderWhere } from '@/lib/order-list';
import { restockStatusLabelForHq } from '@/lib/restock-request/constants';
import { snapshotView } from '@/lib/shopify/snapshot-view';

export const REVIEW_KINDS = ['shopify_order', 'ugc', 'restock'] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export type ReviewInboxItem = {
  id: string;
  kind: ReviewKind;
  kindLabel: string;
  title: string;
  subtitle: string;
  href: string;
  createdAt: Date;
  statusLabel: string;
  lines?: string[];
  moreLabel?: string;
};

const MAX_LINES = 6;

export type RestockReviewSummaryInput = {
  itemCount: number;
  requestType: string;
  merchantNote: string | null;
  items: { name: string; quantity: number | null }[];
};

export function restockReviewSummary(
  input: RestockReviewSummaryInput,
): {
  title: string;
  subtitleExtra?: string;
  lines?: string[];
  moreLabel?: string;
} {
  const validItems: { name: string; quantity: number | null }[] = [];
  for (const item of input.items) {
    const name = item.name.trim();
    if (!name) continue;
    validItems.push({ name, quantity: item.quantity });
  }

  const displayText = (item: { name: string; quantity: number | null }) =>
    item.quantity != null ? `${item.name} × ${item.quantity}` : item.name;

  const moreLabelFor = (lines: string[] | undefined) => {
    if (!lines) return undefined;
    if (input.itemCount > lines.length) return `…另 ${input.itemCount - lines.length} 項`;
    return undefined;
  };

  if (input.itemCount >= 1 && validItems.length >= 1) {
    if (input.itemCount === 1) {
      return { title: displayText(validItems[0]!) };
    }
    const lines = validItems.slice(0, MAX_LINES).map(displayText);
    return {
      title: `${validItems[0]!.name} 等 ${input.itemCount} 項`,
      lines,
      moreLabel: moreLabelFor(lines),
    };
  }

  if (input.itemCount >= 1) {
    return {
      title: input.itemCount === 1 ? '補貨申請' : `補貨申請 等 ${input.itemCount} 項`,
    };
  }

  if (input.requestType === 'AUTO_REPLENISH') {
    const cleaned = (input.merchantNote ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const lines = ['店家未列品項，請看店家備註'];
    return {
      title: '請幫我配',
      subtitleExtra: cleaned || undefined,
      lines,
      moreLabel: moreLabelFor(lines),
    };
  }

  const lines = ['此申請沒有品項，請開啟明細確認'];
  return {
    title: '補貨申請（無品項）',
    lines,
    moreLabel: moreLabelFor(lines),
  };
}

const KIND_LABEL: Record<ReviewKind, string> = {
  shopify_order: 'Shopify 訂單',
  ugc: 'UGC 審核',
  restock: '補貨申請',
};

export function reviewKindLabel(kind: ReviewKind) {
  return KIND_LABEL[kind];
}

export function orderContentSummary(order: {
  items: { productName: string }[];
  shopifySnapshot?: unknown;
}) {
  const storedNames = order.items.map((item) => item.productName.trim()).filter(Boolean);
  const snapshotNames = snapshotView(order.shopifySnapshot)?.items
    .map((item) => item.title.trim())
    .filter(Boolean) ?? [];
  const names = storedNames.length > 0 ? storedNames : snapshotNames;
  if (names.length === 0) return '商品明細尚未同步';
  if (names.length === 1) return names[0]!;
  return `${names[0]} 等 ${names.length} 項`;
}

export function orderReferenceSummary(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].join(' · ');
}

async function loadPendingOrders(): Promise<ReviewInboxItem[]> {
  const orders = await prisma.order.findMany({
    where: {
      ...activeOrderWhere,
      status: 'pending_review',
      OR: [{ omsStatus: null }, { omsStatus: { in: ['NEW', 'REVIEW'] } }],
    },
    select: {
      id: true,
      orderNumber: true,
      externalOrderName: true,
      shopifySnapshot: true,
      source: true,
      orderedAt: true,
      createdAt: true,
      customer: { select: { name: true } },
      items: { select: { productName: true }, take: 4 },
    },
    orderBy: { orderedAt: 'desc' },
    take: 80,
  });

  return orders.map((order) => ({
    id: order.id,
    kind: 'shopify_order',
    kindLabel: order.source === 'shopify' ? KIND_LABEL.shopify_order : '訂單待審核',
    title: orderContentSummary(order),
    subtitle: orderReferenceSummary([
      order.externalOrderName ?? order.orderNumber,
      order.customer?.name,
    ]),
    href: `/orders/${order.id}`,
    createdAt: order.orderedAt ?? order.createdAt,
    statusLabel: '待審核',
  }));
}

async function loadPendingRestocks(): Promise<ReviewInboxItem[]> {
  const rows = await prisma.restockRequest.findMany({
    where: { status: { in: ['submitted', 'under_review'] } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      requestType: true,
      merchantNote: true,
      merchant: { select: { name: true } },
      // 顯示品項數只能來自 `_count.items`，禁止由截斷後的 `items.length` 推導。
      _count: { select: { items: true } },
      items: {
        select: { requestedQuantity: true, product: { select: { name: true } } },
        // 巢狀 items 必須有穩定 orderBy。
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 6,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  return rows.map((row) => {
    const summary = restockReviewSummary({
      itemCount: row._count.items,
      requestType: row.requestType,
      merchantNote: row.merchantNote,
      items: row.items.map((item) => ({
        name: item.product.name,
        quantity: item.requestedQuantity,
      })),
    });
    return {
      id: row.id,
      kind: 'restock',
      kindLabel: KIND_LABEL.restock,
      title: summary.title,
      subtitle: [row.merchant.name, summary.subtitleExtra]
        .filter(Boolean)
        .join(' · '),
      href: `/restock-requests/${row.id}`,
      createdAt: row.createdAt,
      statusLabel: restockStatusLabelForHq(row.status),
      lines: summary.lines,
      moreLabel: summary.moreLabel,
    };
  });
}

async function loadPendingUgc(): Promise<ReviewInboxItem[]> {
  try {
    const apps = await prisma.campaignApplication.findMany({
      where: { status: APP_STATUS.PENDING_REVIEW },
      select: {
        id: true,
        createdAt: true,
        lineDisplayName: true,
        recipientName: true,
        storeName: true,
        petName: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return apps.map((app) => ({
      id: app.id,
      kind: 'ugc',
      kindLabel: KIND_LABEL.ugc,
      title: app.petName ? `${app.recipientName || '開箱申請'} · ${app.petName}` : app.recipientName || '開箱申請',
      subtitle: [app.lineDisplayName, app.storeName].filter(Boolean).join(' · '),
      href: `/campaigns/jiba-two-piece/${app.id}`,
      createdAt: app.createdAt,
      statusLabel: '待審核',
    }));
  } catch (error) {
    if (isMissingCampaignTableError(error)) return [];
    throw error;
  }
}

async function countPendingUgc() {
  try {
    return await prisma.campaignApplication.count({
      where: { status: APP_STATUS.PENDING_REVIEW },
    });
  } catch (error) {
    if (isMissingCampaignTableError(error)) return 0;
    throw error;
  }
}

/** 側欄／首頁用的待審核筆數，不載入明細。 */
export async function countReviewInbox(): Promise<Record<ReviewKind, number>> {
  const [shopify_order, restock, ugc] = await Promise.all([
    prisma.order.count({
      where: {
        ...activeOrderWhere,
        status: 'pending_review',
        OR: [{ omsStatus: null }, { omsStatus: { in: ['NEW', 'REVIEW'] } }],
      },
    }),
    prisma.restockRequest.count({
      where: { status: { in: ['submitted', 'under_review'] } },
    }),
    countPendingUgc(),
  ]);
  return { shopify_order, restock, ugc };
}

export async function loadReviewInbox(): Promise<{
  items: ReviewInboxItem[];
  counts: Record<ReviewKind, number>;
}> {
  const [orders, restocks, ugc, counts] = await Promise.all([
    loadPendingOrders(),
    loadPendingRestocks(),
    loadPendingUgc(),
    countReviewInbox(),
  ]);
  const items = [...orders, ...restocks, ...ugc].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return { items, counts };
}

export function reviewInboxTotal(counts: Record<ReviewKind, number>) {
  return counts.shopify_order + counts.restock + counts.ugc;
}
