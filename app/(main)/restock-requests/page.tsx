import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { restockStatusLabelForHq, restockRequestTypeLabel } from '@/lib/restock-request/constants';
import { PageHeader } from '@/components/shared/page-header';
import { formatDateTime } from '@/lib/format';
import { ChevronRight } from 'lucide-react';

export const metadata = { title: '補貨申請 · Furmosa HQ' };

export default async function HqRestockRequestsPage(
  props: {
    searchParams: Promise<{ status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const statusFilter = searchParams.status?.trim();
  const rows = await prisma.restockRequest.findMany({
    where: statusFilter
      ? { status: statusFilter }
      : { status: { in: ['submitted', 'under_review', 'approved'] } },
    orderBy: { createdAt: 'asc' },
    include: {
      merchant: { select: { name: true, merchantId: true } },
      _count: { select: { items: true } },
    },
    take: 100,
  });

  const currentView =
    statusFilter === 'converted_to_shipment'
      ? 'converted'
      : statusFilter === 'rejected'
        ? 'rejected'
        : 'pending';

  const tabs = [
    { key: 'pending', label: '待處理', href: '/restock-requests' },
    { key: 'converted', label: '已轉單', href: '/restock-requests?status=converted_to_shipment' },
    { key: 'rejected', label: '已拒絕', href: '/restock-requests?status=rejected' },
  ];

  const actionLabel = (status: string) =>
    status === 'approved'
      ? '建立出貨單'
      : status === 'submitted' || status === 'under_review'
        ? '審核補貨'
        : '查看';

  return (
    <>
      <PageHeader
        title="補貨申請"
        description="店家 POS 送出的補貨需求；核准後建立出貨單並進入既有物流流程。"
      />
      <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
        <nav aria-label="補貨申請階段" className="overflow-x-auto pb-1">
          <div className="inline-flex min-w-full gap-1 rounded-xl border border-border/70 bg-card p-1.5 sm:min-w-0">
            {tabs.map((tab) => {
              const active = currentView === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors sm:min-w-28 sm:flex-none ${active ? 'bg-black text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
            目前沒有符合條件的申請
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-border/70 bg-card" aria-label="補貨申請列表">
            {rows.map((r) => (
              <article
                key={r.id}
                className="grid gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1.5fr)_minmax(10rem,1fr)_9rem_9rem] md:items-center"
              >
                <div className="min-w-0">
                  <Link href={`/restock-requests/${r.id}`} className="font-semibold hover:underline">
                    {r.merchant.name}
                  </Link>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.merchant.merchantId}</p>
                </div>

                <div className="min-w-0 text-sm">
                  <p className="font-medium">{restockRequestTypeLabel(r.requestType)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r._count.items} 項 · {formatDateTime(r.createdAt)}
                  </p>
                </div>

                <div className="text-sm font-medium">
                  {restockStatusLabelForHq(r.status)}
                </div>

                <Link
                  href={`/restock-requests/${r.id}`}
                  className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-3 text-sm font-semibold hover:bg-muted"
                  aria-label={`${actionLabel(r.status)}：${r.merchant.name}`}
                >
                  {actionLabel(r.status)}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
