import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAuthenticatedMerchantId,
  requireMerchantSession,
} from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';
import { appointmentStatusLabelForMerchant } from '@/lib/booking/constants';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { listSlotsForDay } from '@/lib/booking/service';
import { AppointmentActions } from './appointment-actions';

export const metadata = { title: '預約詳情 · Furmosa 店家' };

export default async function PosAppointmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const row = await prisma.appointment.findFirst({
    where: { id: params.id, merchantId },
    include: { customer: { select: { name: true, phone: true } } },
  });
  if (!row) notFound();

  const dateStr = formatLocalDate(row.startsAt);
  const slots = await listSlotsForDay({
    merchantId,
    dateStr,
    audience: 'merchant',
  });

  return (
    <PosShell>
      <div className="space-y-4 px-4 py-6">
        <Link href="/pos/appointments" className="text-xs text-muted-foreground">
          ← 預約列表
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-navy">預約詳情</h1>
            <p className="text-sm text-muted-foreground">
              {formatLocalDate(row.startsAt)} {formatLocalTime(row.startsAt)}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            {appointmentStatusLabelForMerchant(row.status)}
          </span>
        </div>

        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <p>
              <span className="text-muted-foreground">客人</span>
              <br />
              {row.customer.name}
              {row.customer.phone ? ` · ${row.customer.phone}` : ''}
            </p>
            {row.petName ? (
              <p>
                <span className="text-muted-foreground">寵物</span>
                <br />
                {row.petName}
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">服務</span>
              <br />
              {row.serviceName}
            </p>
            {row.customerNote ? (
              <p>
                <span className="text-muted-foreground">客人備註</span>
                <br />
                {row.customerNote}
              </p>
            ) : null}
            {row.isOverbooked ? (
              <p className="text-amber-700">此筆為店家手動超約。</p>
            ) : null}
          </CardContent>
        </Card>

        {row.status !== 'cancelled' ? (
          <AppointmentActions
            appointmentId={row.id}
            status={row.status}
            slots={slots.map((s) => ({
              value: s.startsAt.toISOString(),
              label: `${formatLocalTime(s.startsAt)}${s.isFull ? '（已滿・可超約）' : ''}`,
            }))}
          />
        ) : null}
      </div>
    </PosShell>
  );
}
