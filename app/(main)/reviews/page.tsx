import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { loadReviewInbox, reviewInboxTotal } from '@/lib/reviews/inbox';
import { ArchiveOlderOrdersForm } from '@/components/orders/archive-older-orders-form';
import { ReviewWorkbench } from '@/components/reviews/review-workbench';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/format';
import { PRODUCT_WISH_SPECIES } from '@/lib/product-wishes/validation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ReviewInboxPage() {
  const inbox = await loadReviewInbox();
  const { items, counts } = inbox;
  const total = reviewInboxTotal(counts);
  const wishes = await prisma.productWish.findMany({
    where: { status: 'pending_review' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

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
        {wishes.length > 0 ? (
          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">許願池</h2>
                <p className="mt-1 text-sm text-muted-foreground">尚未有商品可推薦的需求，先依物種與內容判斷是否找貨。</p>
              </div>
              <Badge variant="warning">{wishes.length} 筆待審核</Badge>
            </div>
            <div className="mt-4 divide-y">
              {wishes.map((wish) => {
                const species = PRODUCT_WISH_SPECIES[wish.species as keyof typeof PRODUCT_WISH_SPECIES] ?? '其他小夥伴';
                return (
                  <Link
                    key={wish.id}
                    href={\`/product-wishes/\${wish.id}\`}
                    className="block rounded-xl px-2 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{species}</Badge>
                      {wish.intent ? <span className="text-xs text-muted-foreground">{wish.intent}</span> : null}
                      <span className="ml-auto text-xs text-muted-foreground">{formatRelative(wish.createdAt)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium">{wish.requestText}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
        {total > 0 ? <ReviewWorkbench items={items} counts={counts} /> : null}
      </div>
    </>
  );
}
