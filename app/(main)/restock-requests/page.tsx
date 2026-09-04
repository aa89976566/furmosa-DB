import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { restockStatusLabelForHq, restockRequestTypeLabel } from '@/lib/restock-request/constants';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '補貨申請 · Furmosa HQ' };

export default async function HqRestockRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
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

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy">補貨申請</h1>
          <p className="text-sm text-muted-foreground">
            店家 POS 送出的補貨申請；核准後會建立正式出貨單
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="underline" href="/restock-requests">
            待處理
          </Link>
          <Link className="underline" href="/restock-requests?status=converted_to_shipment">
            已轉單
          </Link>
          <Link className="underline" href="/restock-requests?status=rejected">
            已拒絕
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            目前沒有符合條件的申請。
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">店家</th>
                <th className="px-3 py-2 font-medium">類型</th>
                <th className="px-3 py-2 font-medium">狀態</th>
                <th className="px-3 py-2 font-medium">品項數</th>
                <th className="px-3 py-2 font-medium">申請時間</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <Link
                      href={`/restock-requests/${r.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {r.merchant.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.merchant.merchantId}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {restockRequestTypeLabel(r.requestType)}
                  </td>
                  <td className="px-3 py-2">{restockStatusLabelForHq(r.status)}</td>
                  <td className="px-3 py-2">{r._count.items}</td>
                  <td className="px-3 py-2">
                    {r.createdAt.toLocaleString('zh-TW')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
