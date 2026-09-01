import { cache } from 'react';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parsePage, totalPages } from '@/lib/list-pagination';
import {
  HQ_RESTOCK_INBOX_LIST_SELECT,
  HQ_RESTOCK_INBOX_PAGE_SIZE,
  HQ_RESTOCK_INBOX_PENDING_STATUSES,
  canAccessHqRestockInbox,
  compareHqRestockInboxRows,
  hqRestockInboxBucketCounts,
  hqRestockInboxListWhere,
  hqRestockInboxStatusesForFilter,
  mapHqRestockInboxRow,
  parseHqRestockInboxFilter,
  type HqRestockInboxBucketCounts,
  type HqRestockInboxFilter,
  type HqRestockInboxListRow,
} from '@/lib/restock-request/hq-inbox';

export const countHqPendingRestockRequests = cache(async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user) return 0;
  try {
    return prisma.restockRequest.count({
      where: { status: { in: [...HQ_RESTOCK_INBOX_PENDING_STATUSES] } },
    });
  } catch {
    return 0;
  }
});

export type HqRestockInboxResult = {
  filter: HqRestockInboxFilter;
  query: string;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  counts: HqRestockInboxBucketCounts;
  rows: HqRestockInboxListRow[];
};

function escapeIlike(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function findInboxPageIds(input: {
  filter: HqRestockInboxFilter;
  query: string;
  skip: number;
  take: number;
}): Promise<string[]> {
  if (input.filter !== 'all') {
    const rows = await prisma.restockRequest.findMany({
      where: hqRestockInboxListWhere({ filter: input.filter, query: input.query }),
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      skip: input.skip,
      take: input.take,
    });
    return rows.map((row) => row.id);
  }

  const statuses = hqRestockInboxStatusesForFilter('all');
  const like = input.query.trim() ? `%${escapeIlike(input.query.trim())}%` : null;
  const searchSql = like
    ? Prisma.sql`AND (
        r.id ILIKE ${like} ESCAPE '\\'
        OR m.name ILIKE ${like} ESCAPE '\\'
        OR m."merchantId" ILIKE ${like} ESCAPE '\\'
      )`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT r.id
    FROM restock_requests r
    INNER JOIN "Merchant" m ON m.id = r.merchant_id
    WHERE r.status IN (${Prisma.join(statuses)})
    ${searchSql}
    ORDER BY
      CASE
        WHEN r.status = 'submitted' THEN 0
        WHEN r.status IN ('under_review', 'approved') THEN 1
        ELSE 2
      END ASC,
      r.created_at DESC
    LIMIT ${input.take} OFFSET ${input.skip}
  `;
  return rows.map((row) => row.id);
}

export async function loadHqRestockInbox(input: {
  filter?: string;
  status?: string;
  q?: string;
  page?: string;
}): Promise<HqRestockInboxResult> {
  const user = await getCurrentUser();
  if (
    !canAccessHqRestockInbox({
      hasHqSession: Boolean(user),
      hasMerchantSession: false,
    })
  ) {
    redirect('/login');
  }

  const filter = parseHqRestockInboxFilter(input.filter, input.status);
  const query = (input.q ?? '').trim();
  const pageSize = HQ_RESTOCK_INBOX_PAGE_SIZE;

  const grouped = await prisma.restockRequest.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: hqRestockInboxListWhere({ filter: 'all', query }),
  });
  const counts = hqRestockInboxBucketCounts(
    grouped.map((row) => ({ status: row.status, count: row._count._all })),
  );

  const totalCount = filter === 'all' ? counts.all : counts[filter];
  const pages = totalPages(totalCount, pageSize);
  const page = Math.min(parsePage(input.page), pages);

  const ids = await findInboxPageIds({
    filter,
    query,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const records =
    ids.length === 0
      ? []
      : await prisma.restockRequest.findMany({
          where: { id: { in: ids } },
          select: HQ_RESTOCK_INBOX_LIST_SELECT,
        });

  const quantityByRequest = new Map<string, number>();
  if (ids.length > 0) {
    const sums = await prisma.restockRequestItem.groupBy({
      by: ['restockRequestId'],
      where: { restockRequestId: { in: ids } },
      _sum: { requestedQuantity: true },
    });
    for (const row of sums) {
      quantityByRequest.set(row.restockRequestId, row._sum.requestedQuantity ?? 0);
    }
  }

  const byId = new Map(records.map((row) => [row.id, row]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (filter === 'all') {
    ordered.sort(compareHqRestockInboxRows);
  }

  return {
    filter,
    query,
    page,
    pageSize,
    totalCount,
    totalPages: pages,
    counts,
    rows: ordered.map((row) =>
      mapHqRestockInboxRow({
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        merchantName: row.merchant.name,
        merchantCode: row.merchant.merchantId,
        itemCount: row._count.items,
        totalRequestedQuantity: quantityByRequest.get(row.id) ?? 0,
      }),
    ),
  };
}
