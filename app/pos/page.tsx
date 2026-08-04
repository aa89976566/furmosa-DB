import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { posLogoutAction } from './actions';
import { PosShell } from '@/components/pos/pos-shell';
import { TodayTaskRowLink } from '@/components/pos/today-task-row';
import { Button } from '@/components/ui/button';
import { loadTodayDashboard } from '@/lib/pos/load-today-dashboard';

export const metadata = {
  title: '今天 · Furmosa 店家',
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
      <div className="space-y-5 px-5 py-12">
        <p className="font-display text-2xl font-semibold text-ink">載入中斷</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {message}
          {showRetryHint ? ' 可先去叫貨，稍後再回來。' : null}
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild className="min-h-[48px] w-full text-base">
            <Link href="/pos/restock">去叫貨</Link>
          </Button>
          <form action={posLogoutAction}>
            <Button type="submit" variant="ghost" className="min-h-[44px] w-full">
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
      return <PosHomeFallback message="資料暫時載不進來。" />;
    }

    if (!merchant || merchant.id !== session.merchantId) {
      return (
        <PosHomeFallback
          message="找不到店家資料，請重新登入。"
          showRetryHint={false}
        />
      );
    }

    const { rows, warning } = await loadTodayDashboard(session.merchantId);
    const empty = rows.length === 0 && !warning;

    return (
      <PosShell>
        <div className="px-5 pb-4 pt-8">
          <header className="mb-8 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-sage">
                Furmosa
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">
                {merchant.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">今天要做的事</p>
            </div>
            <form action={posLogoutAction}>
              <Button
                type="submit"
                variant="ghost"
                className="min-h-[44px] px-3 text-sm text-muted-foreground"
              >
                登出
              </Button>
            </form>
          </header>

          {warning ? (
            <div className="mb-5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-ink">
              {warning}
            </div>
          ) : null}

          {empty ? (
            <section className="space-y-6 py-6">
              <div className="space-y-2">
                <p className="font-display text-3xl font-semibold text-ink">都處理好了</p>
                <p className="max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
                  沒有待辦。需要補貨時直接叫貨即可。
                </p>
              </div>
              <Button asChild className="min-h-[52px] w-full text-base">
                <Link href="/pos/restock">去叫貨</Link>
              </Button>
            </section>
          ) : (
            <section aria-label="今日待辦">
              {rows.map((row) => (
                <TodayTaskRowLink key={`${row.kind}-${row.href}`} row={row} />
              ))}
            </section>
          )}
        </div>
      </PosShell>
    );
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error('[pos] home render', err);
    return <PosHomeFallback message="伺服器渲染時發生錯誤。" />;
  }
}
