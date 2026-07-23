import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { posLogoutAction } from './actions';
import { PosShell } from '@/components/pos/pos-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  restockRequestTypeLabel,
  restockStatusLabelForMerchant,
} from '@/lib/restock-request/constants';

export const metadata = {
  title: '今天 · Furmosa 店家',
};

export default async function PosHomePage() {
  const session = await requireMerchantSession();
  const merchant = await prisma.merchant.findFirst({
    where: { id: session.merchantId },
    select: { id: true, name: true, merchantId: true },
  });

  if (!merchant || merchant.id !== session.merchantId) {
    return (
      <PosShell>
        <div className="px-4 py-10">
          <p className="text-sm text-destructive">找不到店家資料，請重新登入。</p>
        </div>
      </PosShell>
    );
  }

  const openRestocks = await prisma.restockRequest.findMany({
    where: {
      merchantId: session.merchantId,
      status: { in: ['submitted', 'under_review', 'approved', 'converted_to_shipment'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      requestType: true,
      status: true,
      expectedArrivalDate: true,
      createdAt: true,
    },
  });

  return (
    <PosShell>
      <div className="px-4 py-6">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Furmosa 店家</p>
            <h1 className="text-xl font-semibold text-navy">{merchant.name}</h1>
            <p className="text-xs text-muted-foreground">今天</p>
          </div>
          <form action={posLogoutAction}>
            <Button type="submit" variant="ghost" className="min-h-[44px] px-3 text-sm">
              登出
            </Button>
          </form>
        </header>

        <div className="grid gap-3">
          {openRestocks.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="space-y-3 p-5">
                <p className="font-medium text-foreground">今天都處理好了。</p>
                <p className="text-sm text-muted-foreground">
                  預約、換罐與庫存提醒還在準備中，目前可先用叫貨。
                </p>
                <Button asChild className="min-h-[44px] w-full">
                  <Link href="/pos/restock">需要補貨嗎？</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">補貨進度</h2>
                <Link href="/pos/restock/progress" className="text-xs text-primary">
                  看全部
                </Link>
              </div>
              {openRestocks.map((r) => (
                <Link key={r.id} href={`/pos/restock/${r.id}`}>
                  <Card className="shadow-card transition hover:border-primary/30">
                    <CardContent className="flex min-h-[64px] items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {restockRequestTypeLabel(r.requestType)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.expectedArrivalDate
                            ? `預計到貨 ${r.expectedArrivalDate.toLocaleDateString('zh-TW')}`
                            : `送出 ${r.createdAt.toLocaleString('zh-TW')}`}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                        {restockStatusLabelForMerchant(r.status)}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </section>
          )}

          <Card className="border-dashed">
            <CardContent className="space-y-1 p-4">
              <p className="text-sm font-medium text-muted-foreground">準備中</p>
              <p className="text-xs text-muted-foreground">
                下一位客人、待換罐、缺貨提醒 — 等後端就緒後才會顯示真實資料，不會先放假數字。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PosShell>
  );
}
