import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { loadReviewInbox, reviewInboxTotal } from '@/lib/reviews/inbox';
import { ArchiveOlderOrdersForm } from '@/components/orders/archive-older-orders-form';
import { ReviewWorkbench } from '@/components/reviews/review-workbench';

export const dynamic = 'force-dynamic';

export default async function ReviewInboxPage() {
  const inbox = await loadReviewInbox();
  const { items, counts } = inbox;
  const total = reviewInboxTotal(counts);

  return (
    <>
      <PageHeader
        tone="operations"
        title="待審核"
        description="只顯示現在需要判斷的項目。選取案件後，可在同一畫面核對內容與下一步。"
        actions={<Link href="/shipments?status=pending" className="text-sm font-medium underline underline-offset-4">查看已審核訂單</Link>}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex justify-end">
          <details className="relative">
            <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">管理</summary>
            <div className="absolute right-0 top-7 z-30 w-[min(90vw,24rem)] rounded-xl border bg-card p-3 shadow-lg"><ArchiveOlderOrdersForm /></div>
          </details>
        </div>
        {total === 0 ? <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-semibold">目前沒有待審核訂單</p>
          <p className="mt-1 text-muted-foreground">目前沒有需要人工判斷的案件。</p>
          <div className="mt-3 flex flex-wrap gap-3"><Link href="/shipments?status=pending" className="inline-flex min-h-10 items-center rounded-lg bg-foreground px-4 font-medium text-background">查看已審核訂單</Link><Link href="/orders?work=all" className="inline-flex min-h-10 items-center rounded-lg border px-4 font-medium">查找訂單</Link></div>
        </div> : null}
        {total > 0 ? <ReviewWorkbench items={items} counts={counts} /> : null}
      </div>
    </>
  );
}
