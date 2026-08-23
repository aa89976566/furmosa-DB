import Link from 'next/link';
import {
  getAuthenticatedMerchantId,
  requireMerchantSession,
} from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { PosShell } from '@/components/pos/pos-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { appointmentStatusLabelForMerchant } from '@/lib/booking/constants';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';

export const metadata = { title: '預約 · Furmosa 店家' };

export default async function PosAppointmentsPage() {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();

  const rows = await prisma.appointment.findMany({
    where: { merchantId },
    orderBy: [{ status: 'asc' }, { startsAt: 'asc' }],
    take: 80,
    include: {
      customer: { select: { name: true, phone: true } },
    },
  });

  const pending = rows.filter((r) => r.status === 'requested');
  const others = rows.filter((r) => r.status !== 'requested');

  return (
    <PosShell>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-3 border-b border-[#e7e5e4] pb-5">
          <div>
            <Link href="/pos" className="text-sm text-muted-foreground">
              ← 今日工作台
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-[#191919]">預約</h1>
            <p className="mt-1 text-sm text-muted-foreground">確認新預約，或調整已接受的預約時間。</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="min-h-[44px] bg-[#191919] hover:bg-black">
              <Link href="/pos/appointments/new">手動新增</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link href="/pos/appointments/schedule">班表設定</Link>
            </Button>
          </div>
        </div>

        <section className="mb-6 space-y-2">
          <h2 className="text-base font-semibold">待確認（{pending.length}）</h2>
          {pending.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                目前沒有待確認的預約。
              </CardContent>
            </Card>
          ) : (
            pending.map((r) => (
              <AppointmentRow key={r.id} r={r} />
            ))
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">所有預約</h2>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">目前沒有其他預約。</p>
          ) : (
            others.map((r) => <AppointmentRow key={r.id} r={r} />)
          )}
        </section>
      </div>
    </PosShell>
  );
}

function AppointmentRow({
  r,
}: {
  r: {
    id: string;
    startsAt: Date;
    status: string;
    serviceName: string;
    petName: string | null;
    isOverbooked: boolean;
    customer: { name: string; phone: string | null };
  };
}) {
  return (
    <Link href={`/pos/appointments/${r.id}`}>
      <Card className="border-[#e7e5e4] bg-white shadow-none transition hover:border-[#8a8a8a]">
        <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {formatLocalDate(r.startsAt)} {formatLocalTime(r.startsAt)} ·{' '}
              {r.customer.name}
              {r.petName ? `（${r.petName}）` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {r.serviceName}
              {r.isOverbooked ? ' · 門市加開' : ''}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            {appointmentStatusLabelForMerchant(r.status)}
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
