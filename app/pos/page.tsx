import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { posLogoutAction } from './actions';
import { PosShell } from '@/components/pos/pos-shell';
import { TodayTaskRowLink } from '@/components/pos/today-task-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { loadTodayDashboard } from '@/lib/pos/load-today-dashboard';
import { processAppointmentReminders } from '@/lib/booking/reminders';
import { runThrottled } from '@/lib/job-throttle';

export const metadata = {
  title: '今天 · Furmosa 店家',
};

export const dynamic = 'force-dynamic';

/** 背景掃提醒：絕不阻斷／拖垮首頁 SSR */
function kickBookingRemindersInBackground() {
  try {
    void Promise.resolve()
      .then(() =>
        runThrottled(
          'booking-reminders',
          () => processAppointmentReminders(),
          15 * 60 * 1000,
        ),
      )
      .catch((e) => console.error('[pos] booking-reminders', e));
  } catch (e) {
    console.error('[pos] booking-reminders schedule', e);
  }
}

export default async function PosHomePage() {
  const session = await requireMerchantSession();
  kickBookingRemindersInBackground();

  let merchant: { id: string; name: string; merchantId: string } | null = null;
  try {
    merchant = await prisma.merchant.findFirst({
      where: { id: session.merchantId },
      select: { id: true, name: true, merchantId: true },
    });
  } catch (err) {
    console.error('[pos] merchant lookup', err);
    return (
      <PosShell>
        <div className="space-y-4 px-4 py-10">
          <p className="text-sm text-destructive">
            資料暫時載不進來，請稍後再試。
          </p>
          <form action={posLogoutAction}>
            <Button type="submit" variant="outline" className="min-h-[44px]">
              登出並重試
            </Button>
          </form>
        </div>
      </PosShell>
    );
  }

  if (!merchant || merchant.id !== session.merchantId) {
    return (
      <PosShell>
        <div className="px-4 py-10">
          <p className="text-sm text-destructive">找不到店家資料，請重新登入。</p>
          <form action={posLogoutAction} className="mt-4">
            <Button type="submit" variant="outline" className="min-h-[44px]">
              登出
            </Button>
          </form>
        </div>
      </PosShell>
    );
  }

  const { rows, warning } = await loadTodayDashboard(session.merchantId);
  const empty = rows.length === 0 && !warning;

  return (
    <PosShell>
      <div className="px-4 py-6">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-navy">{merchant.name}</h1>
            <p className="text-sm text-muted-foreground">今天</p>
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

        <div className="grid gap-3">
          {empty ? (
            <Card className="shadow-card">
              <CardContent className="space-y-3 p-5">
                <p className="font-medium text-foreground">今天都處理好了。</p>
                <p className="text-sm text-muted-foreground">需要補貨嗎？</p>
                <Button asChild className="min-h-[44px] w-full">
                  <Link href="/pos/restock">去叫貨</Link>
                </Button>
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
}
