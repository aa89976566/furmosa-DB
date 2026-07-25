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
import { countPendingAppointments } from '@/lib/booking/service';
import {
  formatLocalDate,
  formatLocalTime,
} from '@/lib/booking/availability';
import { processAppointmentReminders } from '@/lib/booking/reminders';
import { runThrottled } from '@/lib/job-throttle';

export const metadata = {
  title: '今天 · Furmosa 店家',
};

export default async function PosHomePage() {
  const session = await requireMerchantSession();
  // Hobby 無 hourly cron：店家開「今天」時節流掃 T−2h 提醒
  void runThrottled(
    'booking-reminders',
    () => processAppointmentReminders(),
    15 * 60 * 1000,
  ).catch((e) => console.error('[pos] booking-reminders', e));
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

  const [pendingAppointments, nextAppointment, openRestocks] = await Promise.all([
    countPendingAppointments(session.merchantId),
    prisma.appointment.findFirst({
      where: {
        merchantId: session.merchantId,
        status: { in: ['confirmed', 'requested'] },
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: 'asc' },
      include: { customer: { select: { name: true } } },
    }),
    prisma.restockRequest.findMany({
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
    }),
  ]);

  const hasSomething =
    pendingAppointments > 0 || nextAppointment || openRestocks.length > 0;

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
          {!hasSomething ? (
            <Card className="shadow-card">
              <CardContent className="space-y-3 p-5">
                <p className="font-medium text-foreground">今天都處理好了。</p>
                <p className="text-sm text-muted-foreground">
                  需要時可看預約或叫貨。換罐提醒仍在準備中。
                </p>
                <Button asChild className="min-h-[44px] w-full">
                  <Link href="/pos/appointments">看預約</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {pendingAppointments > 0 ? (
            <Link href="/pos/appointments">
              <Card className="shadow-card transition hover:border-primary/40">
                <CardContent className="flex min-h-[72px] items-center justify-between p-4">
                  <div>
                    <p className="font-medium">待確認預約</p>
                    <p className="text-sm text-muted-foreground">客人在等你回覆</p>
                  </div>
                  <span className="text-lg font-semibold text-primary">
                    {pendingAppointments}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {nextAppointment ? (
            <Link href={`/pos/appointments/${nextAppointment.id}`}>
              <Card className="shadow-card transition hover:border-primary/40">
                <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">下一位</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {nextAppointment.customer.name}
                      {nextAppointment.petName
                        ? ` · ${nextAppointment.petName}`
                        : ''}{' '}
                      · {formatLocalDate(nextAppointment.startsAt)}{' '}
                      {formatLocalTime(nextAppointment.startsAt)}
                    </p>
                  </div>
                  <span className="text-sm text-primary">查看</span>
                </CardContent>
              </Card>
            </Link>
          ) : null}

          {openRestocks.length > 0 ? (
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
          ) : null}

          <Card className="border-dashed">
            <CardContent className="space-y-1 p-4">
              <p className="text-sm font-medium text-muted-foreground">準備中</p>
              <p className="text-xs text-muted-foreground">
                待換罐、缺貨提醒 — 等後端就緒後才顯示真實資料。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PosShell>
  );
}
