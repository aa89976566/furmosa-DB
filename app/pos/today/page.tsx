import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { posLogoutAction } from '../actions';
import { PosShell } from '@/components/pos/pos-shell';
import { TodayTaskRowLink } from '@/components/pos/today-task-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { loadTodayDashboard } from '@/lib/pos/load-today-dashboard';

export const metadata = {
  title: '今天 · Furmosa 店家',
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function PosTodayFallback({
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
          {showRetryHint ? ' 請稍後再試，或先前往叫貨。' : null}
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild className="min-h-[44px] w-full">
            <Link href="/pos/restock">前往叫貨</Link>
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

export default async function PosTodayPage() {
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
        <PosTodayFallback message="資料暫時載不進來。" />
      );
    }

    if (!merchant || merchant.id !== session.merchantId) {
      return (
        <PosTodayFallback
          message="找不到店家資料，請重新登入。"
          showRetryHint={false}
        />
      );
    }

    const { rows, warning } = await loadTodayDashboard(session.merchantId);
    const empty = rows.length === 0 && !warning;

    return (
      <PosShell storeName={merchant.name}>
        <div className="px-4 py-6 md:px-2 md:py-4">
          <header className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-navy">{merchant.name}</h1>
              <p className="text-sm text-muted-foreground">今天</p>
            </div>
            <form action={posLogoutAction} className="md:hidden">
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

          <div className="grid gap-3">
            {empty ? (
              <Card className="shadow-card">
                <CardContent className="space-y-3 p-5">
                  <p className="font-medium text-foreground">今天都處理好了。</p>
                  <p className="text-sm text-muted-foreground">
                    需要時可收銀、看換罐或叫貨。
                  </p>
                  <div className="grid gap-2">
                    <Button asChild className="min-h-[44px] w-full">
                      <Link href="/pos">去收銀</Link>
                    </Button>
                    <Button asChild variant="outline" className="min-h-[44px] w-full">
                      <Link href="/pos/refill">看換罐</Link>
                    </Button>
                    <Button asChild variant="outline" className="min-h-[44px] w-full">
                      <Link href="/pos/restock">去叫貨</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {rows.map((row) => (
              <TodayTaskRowLink key={`${row.kind}-${row.href}`} row={row} />
            ))}

            {warning ? (
              <Button asChild variant="outline" className="min-h-[44px] w-full">
                <Link href="/pos/restock">前往叫貨</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </PosShell>
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error('[pos] today render', err);
    return (
      <PosTodayFallback message="伺服器渲染時發生錯誤。" />
    );
  }
}
