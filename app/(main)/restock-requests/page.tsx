import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ListPagination } from '@/components/shared/list-pagination';
import { hrefWithPage } from '@/lib/list-pagination';
import { loadHqRestockInbox } from '@/lib/restock-request/hq-inbox-query';
import {
  HQ_RESTOCK_INBOX_FILTERS,
  HQ_RESTOCK_INBOX_FILTER_LABELS,
  HQ_RESTOCK_INBOX_PATH,
  canAccessHqRestockInbox,
  hqRestockInboxEmptyMessage,
  type HqRestockInboxFilter,
} from '@/lib/restock-request/hq-inbox';

export const metadata = { title: '補貨申請 · Furmosa HQ' };
export const dynamic = 'force-dynamic';

function formatHqTime(value: Date): string {
  return value.toLocaleString('zh-TW');
}

export default async function HqRestockRequestsPage({
  searchParams,
}: {
  searchParams: { filter?: string; status?: string; q?: string; page?: string };
}) {
  const user = await getCurrentUser();
  if (
    !canAccessHqRestockInbox({
      hasHqSession: Boolean(user),
      hasMerchantSession: false,
    })
  ) {
    redirect('/login');
  }

  const inbox = await loadHqRestockInbox(searchParams);
  const filterState = {
    filter: inbox.filter === 'pending' ? undefined : inbox.filter,
    q: inbox.query || undefined,
  };

  return (
    <>
      <PageHeader
        tone="orders"
        title="補貨申請"
        description="查看店家送出的補貨需求與處理進度。"
      />

      <div className="space-y-4 p-4 sm:p-6">
        <form className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end" method="get">
          {inbox.filter !== 'pending' ? (
            <input type="hidden" name="filter" value={inbox.filter} />
          ) : null}
          <div className="min-w-0 flex-1">
            <label htmlFor="restock-inbox-q" className="text-sm font-medium text-navy">
              搜尋申請
            </label>
            <Input
              id="restock-inbox-q"
              name="q"
              type="search"
              defaultValue={inbox.query}
              placeholder="申請編號、店家名稱或店家編號"
              className="mt-1"
            />
          </div>
          <Button type="submit" className="min-h-10">
            搜尋
          </Button>
          {inbox.query ? (
            <Button variant="outline" asChild className="min-h-10">
              <Link href={inbox.filter === 'pending' ? HQ_RESTOCK_INBOX_PATH : `${HQ_RESTOCK_INBOX_PATH}?filter=${inbox.filter}`}>
                清除搜尋
              </Link>
            </Button>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">狀態</span>
          {HQ_RESTOCK_INBOX_FILTERS.map((filter) => {
            const active = inbox.filter === filter;
            const href =
              filter === 'pending'
                ? inbox.query
                  ? `${HQ_RESTOCK_INBOX_PATH}?q=${encodeURIComponent(inbox.query)}`
                  : HQ_RESTOCK_INBOX_PATH
                : `${HQ_RESTOCK_INBOX_PATH}?filter=${filter}${
                    inbox.query ? `&q=${encodeURIComponent(inbox.query)}` : ''
                  }`;
            return (
              <Button key={filter} variant={active ? 'default' : 'outline'} size="sm" asChild>
                <Link href={href} aria-current={active ? 'page' : undefined}>
                  {HQ_RESTOCK_INBOX_FILTER_LABELS[filter as HqRestockInboxFilter]}
                  <span className="ml-1 tabular-nums text-xs opacity-80">
                    {inbox.counts[filter]}
                  </span>
                </Link>
              </Button>
            );
          })}
        </div>

        <ListPagination
          page={inbox.page}
          totalPages={inbox.totalPages}
          totalCount={inbox.totalCount}
          pageSize={inbox.pageSize}
          prevHref={
            inbox.page > 1 ? hrefWithPage(HQ_RESTOCK_INBOX_PATH, filterState, inbox.page - 1) : null
          }
          nextHref={
            inbox.page < inbox.totalPages
              ? hrefWithPage(HQ_RESTOCK_INBOX_PATH, filterState, inbox.page + 1)
              : null
          }
          label="筆申請"
        />

        {inbox.rows.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>{hqRestockInboxEmptyMessage(inbox.filter)}</p>
              {inbox.filter === 'pending' ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${HQ_RESTOCK_INBOX_PATH}?filter=all`}>查看全部</Link>
                </Button>
              ) : inbox.query || inbox.filter !== 'all' ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={HQ_RESTOCK_INBOX_PATH}>回到待處理</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">申請編號</th>
                  <th className="px-3 py-2 font-medium">店家</th>
                  <th className="px-3 py-2 font-medium">送出時間</th>
                  <th className="px-3 py-2 font-medium">品項數</th>
                  <th className="px-3 py-2 font-medium">申請總數量</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 font-medium">最後更新</th>
                  <th className="px-3 py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {inbox.rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs sm:text-sm">{row.requestNumber}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-navy">{row.merchantName}</p>
                      <p className="text-xs text-muted-foreground">{row.merchantCode}</p>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatHqTime(row.createdAt)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.itemCount}</td>
                    <td className="px-3 py-2 tabular-nums">{row.totalRequestedQuantity}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatHqTime(row.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={row.detailHref}>查看申請</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
