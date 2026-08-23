import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { posLogoutAction } from './actions';
import { PosShell } from '@/components/pos/pos-shell';
import { TodayTaskRowLink } from '@/components/pos/today-task-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { loadTodayDashboard } from '@/lib/pos/load-today-dashboard';
import { formatCurrency } from '@/lib/format';

export const metadata = {
  title: '門市首頁 · Furmosa 店家',
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function PosHomeFallback({
  message,
  showRetryHint = true,
}: {
  message: string;
  showRetryHint?: boolean;
}) {
  return (
    <PosShell>
      <div className="space-y-4 px-4 py-10">
        <h1 className="text-lg font-semibold text-navy">今天暫時無法載入</h1>
        <p className="text-sm text-muted-foreground">
          {message}
          {showRetryHint ? ' 請稍後再試，或先建立補貨單。' : null}
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild className="min-h-[44px] w-full">
            <Link href="/pos/restock">開啟補貨</Link>
          </Button>
          <form action={posLogoutAction}>
            <Button type="submit" variant="outline" className="min-h-[44px] w-full">
              登出並重試
            </Button>
          </form>
        </div>
      </div>
    </PosShell>
  );
}

export default async function PosHomePage() {
  try {
    const session = await requireMerchantSession();

    let merchant: { id: string; name: string; merchantId: string } | null = null;
    try {
      merchant = await prisma.merchant.findFirst({
        where: { id: session.merchantId },
        select: { id: true, name: true, merchantId: true },
      });
    } catch (err) {
      console.error('[pos] merchant lookup', err);
      return (
        <PosHomeFallback message="資料暫時載不進來。" />
      );
    }

    if (!merchant || merchant.id !== session.merchantId) {
      return (
        <PosHomeFallback
          message="找不到店家資料，請重新登入。"
          showRetryHint={false}
        />
      );
    }

    const { rows, warning, metrics } = await loadTodayDashboard(session.merchantId);
    return (
      <PosShell>
        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex items-center justify-between gap-4 border-b border-[#e7e5e4] pb-5">
            <div>
              <p className="text-sm text-muted-foreground">{merchant.name}</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#191919]">門市首頁</h1>
            </div>
            <form action={posLogoutAction}>
              <Button type="submit" variant="ghost" className="min-h-[44px] px-3 text-sm">
                登出
              </Button>
            </form>
          </header>

          {warning ? (
            <Card className="mb-3 border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-950">{warning}</CardContent>
            </Card>
          ) : null}

          <div className="space-y-6">
            <section className="grid overflow-hidden rounded-2xl border border-[#e7e5e4] bg-white shadow-sm lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
              <div className="flex flex-col justify-between p-6 sm:p-8">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">主要操作</p>
                  <h2 className="mt-2 text-2xl font-semibold">準備好就開始下一筆銷售</h2>
                  <p className="mt-2 text-sm text-muted-foreground">選商品、確認收款，系統會同步建立訂單與更新庫存。</p>
                </div>
                <Button asChild className="mt-7 min-h-[54px] w-full bg-[#191919] text-base font-semibold hover:bg-black sm:w-56">
                  <Link href="/pos/checkout">開始收銀</Link>
                </Button>
              </div>
              <div className="grid grid-cols-3 border-t border-[#e7e5e4] bg-[#fafafa] lg:grid-cols-1 lg:border-l lg:border-t-0">
                <Metric label="今日銷售" value={formatCurrency(metrics.salesTotal)} />
                <Metric label="完成訂單" value={`${metrics.completedOrders} 筆`} />
                <Metric label="待處理" value={`${metrics.actionCount} 件`} />
              </div>
            </section>

            <section aria-labelledby="now-title">
              <div className="mb-3">
                <h2 id="now-title" className="text-lg font-semibold">現在要處理</h2>
                <p className="text-sm text-muted-foreground">只顯示需要留意或接續處理的事情</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[#e7e5e4] bg-white shadow-sm">
                {rows.length > 0 ? (
                  <div className="divide-y divide-[#eee]">
                    {rows.map((row) => (
                      <TodayTaskRowLink key={`${row.kind}-${row.href}`} row={row} />
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-10 text-center">
                    <p className="font-medium">目前沒有待處理事項</p>
                    <p className="mt-1 text-sm text-muted-foreground">有新的預約、換罐或庫存提醒時會顯示在這裡。</p>
                  </div>
                )}
              </div>
            </section>

            {warning ? (
              <Button asChild variant="outline" className="min-h-[44px] w-full">
                <Link href="/pos/restock">開啟補貨</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </PosShell>
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error('[pos] home render', err);
    return (
      <PosHomeFallback message="伺服器渲染時發生錯誤。" />
    );
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-[#e7e5e4] px-4 py-5 last:border-r-0 lg:border-b lg:border-r-0 lg:px-6 lg:last:border-b-0">
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{value}</p>
    </div>
  );
}
