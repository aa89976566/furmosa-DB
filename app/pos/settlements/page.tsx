import Link from 'next/link';
import { getAuthenticatedMerchantId, requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '結算 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

const statusLabels: Record<string, string> = {
  draft: '整理中',
  reviewing: '總部核對中',
  approved: '已確認',
  paid: '已完成付款',
};

function money(value: number) {
  return `NT$${Math.round(value).toLocaleString('zh-TW')}`;
}

export default async function PosSettlementsPage() {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const rows = await prisma.settlement.findMany({
    where: { merchantId },
    orderBy: { periodEnd: 'desc' },
    take: 24,
    select: {
      id: true,
      settlementId: true,
      periodStart: true,
      periodEnd: true,
      grossSales: true,
      commissionAmount: true,
      rewardPayout: true,
      shippingFee: true,
      merchantOwesUs: true,
      payable: true,
      status: true,
      paidAt: true,
    },
  });

  return (
    <PosShell>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <header className="mb-6 border-b border-[#e7e5e4] pb-5">
          <Link href="/pos/records" className="text-sm text-muted-foreground">
            ← 紀錄
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[#191919]">結算</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            每一期分開顯示；已完成的舊結算不會重新開啟。
          </p>
        </header>

        {rows.length === 0 ? (
          <Card className="border-[#e7e5e4] bg-white shadow-none">
            <CardContent className="p-6 text-sm text-muted-foreground">
              目前還沒有結算紀錄。
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.id} className="border-[#e7e5e4] bg-white shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#191919]">
                        {row.periodStart.toLocaleDateString('zh-TW')}－
                        {row.periodEnd.toLocaleDateString('zh-TW')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.settlementId}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                      {statusLabels[row.status] ?? row.status}
                    </span>
                  </div>

                  <dl className="mt-4 divide-y divide-[#e7e5e4] border-y border-[#e7e5e4] text-sm">
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">本期門市銷售</dt>
                      <dd className="font-medium">{money(row.grossSales)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">門市分潤</dt>
                      <dd className="font-medium">{money(row.commissionAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">換罐補貼與運費</dt>
                      <dd className="font-medium">{money(row.rewardPayout + row.shippingFee)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">門市應匯總部</dt>
                      <dd className="font-semibold">{money(row.merchantOwesUs)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-3">
                      <dt className="text-muted-foreground">總部應付門市</dt>
                      <dd className="font-semibold">{money(row.payable)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PosShell>
  );
}
