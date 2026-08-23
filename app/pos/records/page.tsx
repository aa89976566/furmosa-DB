import Link from 'next/link';
import { getAuthenticatedMerchantId, requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '紀錄 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

export default async function PosRecordsPage() {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();

  const [salesCount, fulfillmentCount, restockCount, settlementCount] = await Promise.all([
    prisma.order.count({ where: { merchantId } }),
    prisma.refillFulfillment.count({ where: { merchantId, status: 'completed' } }),
    prisma.restockRequest.count({ where: { merchantId } }),
    prisma.settlement.count({ where: { merchantId } }),
  ]);

  const sections = [
    {
      href: '/pos/sales',
      title: '銷售紀錄',
      description: '查看訂單、商品金額與付款狀態',
      count: `${salesCount} 筆`,
    },
    {
      href: '/pos/refill',
      title: '換罐紀錄',
      description: '查看待交付訂單與已完成的交付結果',
      count: `${fulfillmentCount} 筆已完成`,
    },
    {
      href: '/pos/restock/progress',
      title: '補貨紀錄',
      description: '追蹤門市補貨申請與預計到貨日',
      count: `${restockCount} 筆`,
    },
    {
      href: '/pos/settlements',
      title: '結算',
      description: '查看每期銷售、分潤與應收應付',
      count: `${settlementCount} 期`,
    },
  ];

  return (
    <PosShell>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <header className="mb-6 border-b border-[#e7e5e4] pb-5">
          <p className="text-sm text-muted-foreground">門市工作</p>
          <h1 className="mt-1 text-2xl font-semibold text-[#191919]">紀錄</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            所有資料都來自門市實際操作，不顯示示範紀錄。
          </p>
        </header>

        <div className="overflow-hidden rounded-2xl border border-[#e7e5e4] bg-white">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="block">
              <Card className="rounded-none border-0 border-b border-[#e7e5e4] bg-white shadow-none last:border-b-0 hover:bg-[#fafafa]">
                <CardContent className="flex min-h-[88px] items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#191919]">{section.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-[#191919]">{section.count}</p>
                    <span aria-hidden="true" className="text-muted-foreground">→</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PosShell>
  );
}
