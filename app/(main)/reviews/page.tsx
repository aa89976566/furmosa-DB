import { PageHeader } from '@/components/shared/page-header';
import { loadReviewInbox, reviewInboxTotal } from '@/lib/reviews/inbox';
import { ArchiveOlderOrdersForm } from '@/components/orders/archive-older-orders-form';
import { ReviewResourceList } from '@/components/reviews/review-resource-list';

export const dynamic = 'force-dynamic';

export default async function ReviewInboxPage() {
  const { items, counts } = await loadReviewInbox();
  const total = reviewInboxTotal(counts);

  return (
    <>
      <PageHeader
        tone="operations"
        title="待審核"
        description="需要人工下一步的訂單、UGC 與補貨申請集中在這裡；每一列直接顯示現在要做什麼。"
      />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">待處理 {total}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">訂單 {counts.shopify_order}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">UGC {counts.ugc}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">補貨 {counts.restock}</span>
          </div>
          <details className="relative">
            <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
              管理
            </summary>
            <div className="absolute right-0 top-7 z-30 w-[min(90vw,24rem)] rounded-xl border bg-card p-3 shadow-lg">
              <ArchiveOlderOrdersForm />
            </div>
          </details>
        </div>

        <ReviewResourceList items={items} />
      </div>
    </>
  );
}
