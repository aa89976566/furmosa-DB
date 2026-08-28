import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { countReviewInbox, reviewInboxTotal } from '@/lib/reviews/inbox';

export async function DashboardReviewCard() {
  const counts = await countReviewInbox();
  const total = reviewInboxTotal(counts);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-navy">待審核</p>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `有 ${total} 筆需要確認（訂單 ${counts.shopify_order}、開箱 ${counts.ugc}、補貨 ${counts.restock}）`
              : '目前沒有需要確認的項目'}
          </p>
        </div>
        <Button asChild size="sm" variant={total > 0 ? 'default' : 'outline'}>
          <Link href="/reviews">打開待審核</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
