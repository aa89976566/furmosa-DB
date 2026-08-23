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
import type { TodayTaskRow } from '@/lib/pos/today-dashboard';

export const metadata = {
  title: '今日工作台 · Furmosa 店家',
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

    const { rows, warning } = await loadTodayDashboard(session.merchantId);
    return (
      <PosShell>
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex items-start justify-between gap-3 border-b border-[#e7e5e4] pb-5">
            <div>
              <p className="text-sm text-muted-foreground">{merchant.name}</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#191919]">今日工作台</h1>
              <p className="mt-1 text-sm text-muted-foreground">這裡只顯示門市現在需要完成的工作。</p>
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

          <div className="space-y-7">
            <DashboardSection
              title="待處理"
              description="請先完成這些工作"
              rows={rows.filter((row) =>
                ['pending_confirm', 'pending_refill'].includes(row.kind),
              )}
              emptyText="目前沒有待處理事項。"
            />

            <DashboardSection
              title="今日預約"
              description="最近一筆即將到店的預約"
              rows={rows.filter((row) => row.kind === 'next_guest')}
              emptyText="目前沒有即將到店的預約。"
              action={{ href: '/pos/appointments', label: '全部預約' }}
            />

            <DashboardSection
              title="庫存與補貨"
              description="需要補貨的商品與尚未完成的補貨單"
              rows={rows.filter((row) =>
                ['low_stock', 'restock_progress'].includes(row.kind),
              )}
              emptyText="目前沒有庫存或補貨提醒。"
              action={{ href: '/pos/restock', label: '補貨首頁' }}
            />

            <section aria-labelledby="quick-actions-title">
              <div className="mb-3">
                <h2 id="quick-actions-title" className="text-base font-semibold">快速操作</h2>
                <p className="text-sm text-muted-foreground">直接進入門市常用功能</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Button asChild className="min-h-[48px] bg-[#191919] hover:bg-black">
                  <Link href="/pos/checkout">開始收銀</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[48px] bg-white">
                  <Link href="/pos/appointments/new">新增預約</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[48px] bg-white">
                  <Link href="/pos/refill">交付換罐商品</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-[48px] bg-white">
                  <Link href="/pos/restock/new">建立補貨單</Link>
                </Button>
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

function DashboardSection({
  title,
  description,
  rows,
  emptyText,
  action,
}: {
  title: string;
  description: string;
  rows: TodayTaskRow[];
  emptyText: string;
  action?: { href: string; label: string };
}) {
  return (
    <section aria-labelledby={`section-${title}`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id={`section-${title}`} className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? (
          <Link href={action.href} className="shrink-0 text-sm font-medium underline underline-offset-4">
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className="grid gap-2">
        {rows.length > 0 ? rows.map((row) => (
          <TodayTaskRowLink key={`${row.kind}-${row.href}`} row={row} />
        )) : (
          <Card className="border-[#e7e5e4] bg-white shadow-none">
            <CardContent className="p-4 text-sm text-muted-foreground">{emptyText}</CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
