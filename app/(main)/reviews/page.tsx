import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { loadReviewInbox, reviewInboxTotal } from '@/lib/reviews/inbox';

export const dynamic = 'force-dynamic';

export default async function ReviewInboxPage() {
  const { items, counts } = await loadReviewInbox();
  const total = reviewInboxTotal(counts);

  return (
    <>
      <PageHeader
        tone="operations"
        title="待審核"
        description="Shopify 訂單、開箱申請與補貨申請，只要還需要人工確認，都會出現在這裡。核准後才會進入出貨。"
      />
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="flex flex-wrap gap-4 p-4 text-sm">
            <div>
              全部待審核 <span className="font-semibold">{total}</span>
            </div>
            <div className="text-muted-foreground">訂單 {counts.shopify_order}</div>
            <div className="text-muted-foreground">開箱申請 {counts.ugc}</div>
            <div className="text-muted-foreground">補貨申請 {counts.restock}</div>
          </CardContent>
        </Card>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">時間</th>
                <th className="px-3 py-2">種類</th>
                <th className="px-3 py-2">內容</th>
                <th className="px-3 py-2">狀態</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    目前沒有待審核項目
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={`${item.kind}-${item.id}`} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="muted">{item.kindLabel}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-muted-foreground">{item.subtitle || '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="default">{item.statusLabel}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={item.href}>審核</Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
