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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
    include: {
      customer: { select: { name: true, phone: true } },
      refillOrders: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          quantity: true,
          fulfilledQuantity: true,
          totalAmount: true,
          paidAt: true,
          product: { select: { name: true } },
        },
      },
    },
  });
  if (!row) notFound();

  const dateStr = formatLocalDate(row.startsAt);
  const slots = await listSlotsForDay({
    merchantId,
    dateStr,
    audience: 'merchant',
  });
  const refillOrder = row.refillOrders[0] ?? null;
  const refillRemaining = refillOrder
    ? Math.max(0, refillOrder.quantity - refillOrder.fulfilledQuantity)
    : 0;

  return (
    <PosShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <Button asChild variant="ghost" className="min-h-[44px] px-2">
          <Link href="/pos/appointments">← 返回預約</Link>
        </Button>
        <header className="flex items-start justify-between gap-3 border-b border-[#e7e5e4] pb-5">
          <div>
            <p className="text-sm text-muted-foreground">預約資料</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#191919]">
              {formatLocalTime(row.startsAt)} · {row.petName ?? row.customer.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatLocalDate(row.startsAt)} · {row.serviceName}</p>
          </div>
          <Badge variant={row.status === 'cancelled' ? 'muted' : row.status === 'requested' ? 'warning' : 'success'}>
            {appointmentStatusLabelForMerchant(row.status)}
          </Badge>
        </header>

        <section aria-labelledby="appointment-info-title">
          <h2 id="appointment-info-title" className="mb-3 text-base font-semibold">預約資料</h2>
          <Card className="border-[#e7e5e4] bg-white shadow-none">
            <CardContent className="divide-y divide-[#e7e5e4] p-0 text-sm">
              <InfoRow label="時間" value={`${formatLocalDate(row.startsAt)} ${formatLocalTime(row.startsAt)}`} />
              <InfoRow label="顧客" value={row.customer.name} />
              {row.petName ? <InfoRow label="毛孩" value={row.petName} /> : null}
              <InfoRow label="服務" value={row.serviceName} />
              {row.customer.phone ? <InfoRow label="電話" value={row.customer.phone} /> : null}
            </CardContent>
          </Card>
          {row.customerNote ? (
            <Card className="mt-3 border-[#e7e5e4] bg-white shadow-none">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">顧客備註</p>
                <p className="mt-1 text-sm">{row.customerNote}</p>
              </CardContent>
            </Card>
          ) : null}
          {row.isOverbooked ? (
            <p className="mt-2 text-sm text-amber-700">此筆為門市手動加開的預約。</p>
          ) : null}
        </section>

        {(refillOrder || row.serviceName.includes('換罐')) ? (
          <section aria-labelledby="refill-task-title">
            <div className="mb-3">
              <h2 id="refill-task-title" className="text-base font-semibold">換罐處理</h2>
              <p className="text-sm text-muted-foreground">換罐的付款、空罐與交付會獨立記錄。</p>
            </div>
            <Card className="border-[#e7e5e4] bg-white shadow-none">
              <CardContent className="space-y-4 p-4">
                {refillOrder ? (
                  <>
                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <SummaryItem label="商品" value={refillOrder.product?.name ?? '換罐商品'} />
                      <SummaryItem label="付款" value={refillOrder.paidAt ? `已付款 NT$${refillOrder.totalAmount}` : '等待官方 LINE 付款'} />
                      <SummaryItem label="待領取" value={`${refillRemaining}／${refillOrder.quantity} 罐`} />
                    </div>
                    <Button asChild className="min-h-[48px] w-full bg-[#191919] hover:bg-black">
                      <Link href={`/pos/refill/${refillOrder.id}`}>
                        {refillRemaining > 0 ? '處理換罐交付' : '查看換罐紀錄'}
                      </Link>
                    </Button>
                  </>
                ) : (
                  <div>
                    <p className="font-medium">尚無換罐訂單</p>
                    <p className="mt-1 text-sm text-muted-foreground">請顧客先透過官方 LINE 選購並完成付款，訂單才會出現在門市 POS。</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {row.status !== 'cancelled' ? (
          <section aria-labelledby="appointment-actions-title">
            <div className="mb-3">
              <h2 id="appointment-actions-title" className="text-base font-semibold">預約操作</h2>
              <p className="text-sm text-muted-foreground">只會變更預約時間或狀態，不會更動換罐付款與庫存。</p>
            </div>
            <AppointmentActions
              appointmentId={row.id}
              status={row.status}
              slots={slots.map((s) => ({
                value: s.startsAt.toISOString(),
                label: `${formatLocalTime(s.startsAt)}${s.isFull ? '（已滿・可加開）' : ''}`,
              }))}
            />
          </section>
        ) : null}
      </div>
    </PosShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
