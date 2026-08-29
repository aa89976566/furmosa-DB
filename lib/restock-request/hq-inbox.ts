import type { Prisma } from '@prisma/client';
import {
  RESTOCK_REQUEST_STATUSES,
  restockStatusLabelForHq,
  type RestockRequestStatus,
} from '@/lib/restock-request/constants';
import { textContains } from '@/lib/site-search';

/** HQ 尚未開始處理：店家已送出，HQ 還沒改過。 */
export const HQ_RESTOCK_INBOX_PENDING_STATUSES: readonly RestockRequestStatus[] = [
  'submitted',
];

/** HQ 已開始處理，但還沒結束。 */
export const HQ_RESTOCK_INBOX_PROCESSING_STATUSES: readonly RestockRequestStatus[] = [
  'under_review',
  'approved',
];

/** 已結束：轉出貨、拒絕或取消。 */
export const HQ_RESTOCK_INBOX_COMPLETED_STATUSES: readonly RestockRequestStatus[] = [
  'converted_to_shipment',
  'rejected',
  'cancelled',
];

/** 未送出，HQ 收件匣不當成店家申請。 */
export const HQ_RESTOCK_INBOX_HIDDEN_STATUSES: readonly RestockRequestStatus[] = ['draft'];

export const HQ_RESTOCK_INBOX_FILTERS = ['pending', 'processing', 'completed', 'all'] as const;
export type HqRestockInboxFilter = (typeof HQ_RESTOCK_INBOX_FILTERS)[number];

export const HQ_RESTOCK_INBOX_PATH = '/restock-requests';
export const HQ_RESTOCK_INBOX_PAGE_SIZE = 30;

export const HQ_RESTOCK_INBOX_FILTER_LABELS: Record<HqRestockInboxFilter, string> = {
  pending: '待處理',
  processing: '處理中',
  completed: '已完成',
  all: '全部',
};

export function isRestockRequestStatus(value: string): value is RestockRequestStatus {
  return (RESTOCK_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function hqRestockInboxBucket(
  status: string,
): Exclude<HqRestockInboxFilter, 'all'> | null {
  if (!isRestockRequestStatus(status)) return null;
  if ((HQ_RESTOCK_INBOX_HIDDEN_STATUSES as readonly string[]).includes(status)) return null;
  if ((HQ_RESTOCK_INBOX_PENDING_STATUSES as readonly string[]).includes(status)) return 'pending';
  if ((HQ_RESTOCK_INBOX_PROCESSING_STATUSES as readonly string[]).includes(status)) {
    return 'processing';
  }
  if ((HQ_RESTOCK_INBOX_COMPLETED_STATUSES as readonly string[]).includes(status)) {
    return 'completed';
  }
  return null;
}

export function hqRestockInboxStatusesForFilter(
  filter: HqRestockInboxFilter,
): RestockRequestStatus[] {
  switch (filter) {
    case 'pending':
      return [...HQ_RESTOCK_INBOX_PENDING_STATUSES];
    case 'processing':
      return [...HQ_RESTOCK_INBOX_PROCESSING_STATUSES];
    case 'completed':
      return [...HQ_RESTOCK_INBOX_COMPLETED_STATUSES];
    case 'all':
      return RESTOCK_REQUEST_STATUSES.filter(
        (status) => !(HQ_RESTOCK_INBOX_HIDDEN_STATUSES as readonly string[]).includes(status),
      );
  }
}

export function parseHqRestockInboxFilter(
  filterRaw?: string,
  legacyStatus?: string,
): HqRestockInboxFilter {
  if (filterRaw && (HQ_RESTOCK_INBOX_FILTERS as readonly string[]).includes(filterRaw)) {
    return filterRaw as HqRestockInboxFilter;
  }
  if (legacyStatus) {
    return hqRestockInboxBucket(legacyStatus) ?? 'pending';
  }
  return 'pending';
}

/** 數字越小越優先。待處理 0，處理中 1，已完成 2。 */
export function hqRestockInboxSortRank(status: string): number {
  const bucket = hqRestockInboxBucket(status);
  if (bucket === 'pending') return 0;
  if (bucket === 'processing') return 1;
  if (bucket === 'completed') return 2;
  return 3;
}

export function compareHqRestockInboxRows(
  a: { status: string; createdAt: Date },
  b: { status: string; createdAt: Date },
): number {
  const rank = hqRestockInboxSortRank(a.status) - hqRestockInboxSortRank(b.status);
  if (rank !== 0) return rank;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export function hqRestockInboxStatusWhere(
  filter: HqRestockInboxFilter,
): Prisma.RestockRequestWhereInput {
  return { status: { in: hqRestockInboxStatusesForFilter(filter) } };
}

export function hqRestockInboxSearchWhere(
  raw: string,
): Prisma.RestockRequestWhereInput | undefined {
  const q = raw.trim();
  if (!q) return undefined;
  const contains = textContains(q);
  return {
    OR: [
      { id: contains },
      { merchant: { name: contains } },
      { merchant: { merchantId: contains } },
    ],
  };
}

export function hqRestockInboxListWhere(input: {
  filter: HqRestockInboxFilter;
  query: string;
}): Prisma.RestockRequestWhereInput {
  const search = hqRestockInboxSearchWhere(input.query);
  const status = hqRestockInboxStatusWhere(input.filter);
  if (!search) return status;
  return { AND: [status, search] };
}

export type HqRestockInboxBucketCounts = Record<HqRestockInboxFilter, number>;

export function hqRestockInboxBucketCounts(
  rows: Array<{ status: string; count: number }>,
): HqRestockInboxBucketCounts {
  const counts: HqRestockInboxBucketCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    all: 0,
  };
  for (const row of rows) {
    const bucket = hqRestockInboxBucket(row.status);
    if (!bucket) continue;
    counts[bucket] += row.count;
    counts.all += row.count;
  }
  return counts;
}

export function hqRestockInboxBadgeCount(pendingCount: number): number {
  return pendingCount > 0 ? pendingCount : 0;
}

export function hqRestockInboxBadgeVisible(pendingCount: number): boolean {
  return hqRestockInboxBadgeCount(pendingCount) > 0;
}

/** 與 POS 補貨單相同的短編號顯示，連結仍用完整 id。 */
export function restockRequestNumber(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function hqRestockRequestDetailHref(id: string): string {
  return `${HQ_RESTOCK_INBOX_PATH}/${id}`;
}

export type HqRestockInboxListRow = {
  id: string;
  requestNumber: string;
  merchantName: string;
  merchantCode: string;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  totalRequestedQuantity: number;
  status: string;
  statusLabel: string;
  detailHref: string;
};

export function mapHqRestockInboxRow(input: {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  merchantName: string;
  merchantCode: string;
  itemCount: number;
  totalRequestedQuantity: number;
}): HqRestockInboxListRow {
  return {
    id: input.id,
    requestNumber: restockRequestNumber(input.id),
    merchantName: input.merchantName,
    merchantCode: input.merchantCode,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    itemCount: input.itemCount,
    totalRequestedQuantity: input.totalRequestedQuantity,
    status: input.status,
    statusLabel: restockStatusLabelForHq(input.status),
    detailHref: hqRestockRequestDetailHref(input.id),
  };
}

/** 列表只需要這些欄位，不含備註、快照、金額或內部憑證。 */
export const HQ_RESTOCK_INBOX_LIST_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  merchant: {
    select: {
      name: true,
      merchantId: true,
    },
  },
  _count: {
    select: { items: true },
  },
} as const;

export function canAccessHqRestockInbox(input: {
  hasHqSession: boolean;
  hasMerchantSession: boolean;
}): boolean {
  return input.hasHqSession === true;
}

export function hqRestockInboxRevalidatePaths(): string[] {
  return [HQ_RESTOCK_INBOX_PATH];
}

export function hqRestockInboxEmptyMessage(filter: HqRestockInboxFilter): string {
  if (filter === 'pending') return '目前沒有待處理的補貨申請。';
  if (filter === 'processing') return '目前沒有處理中的補貨申請。';
  if (filter === 'completed') return '目前沒有已完成的補貨申請。';
  return '目前沒有補貨申請。';
}
