import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ensureMerchantSettings } from '@/lib/restock-request/service';
import {
  formatLocalDate,
  formatLocalTime,
} from '@/lib/booking/availability';
import {
  listServiceProductsForBooking,
  listSlotsForDay,
} from '@/lib/booking/service';
import { PublicBookForm } from './book-form';

export const metadata = { title: '預約美容 · Furmosa' };

async function resolveMerchant(key: string) {
  return prisma.merchant.findFirst({
    where: {
      status: 'active',
      OR: [{ id: key }, { merchantId: key }],
    },
    select: { id: true, name: true, merchantId: true, city: true },
  });
}

export default async function PublicBookPage({
  params,
  searchParams,
}: {
  params: { merchantKey: string };
  searchParams?: { date?: string };
}) {
  const merchant = await resolveMerchant(params.merchantKey);
  if (!merchant) notFound();

  const settings = await ensureMerchantSettings(merchant.id);
  const dateStr = searchParams?.date || formatLocalDate(new Date());
  const slots = settings.appointmentEnabled
    ? await listSlotsForDay({
        merchantId: merchant.id,
        dateStr,
        audience: 'customer',
      })
    : [];
  const services = await listServiceProductsForBooking();

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg bg-canvas px-4 py-8 text-foreground">
      <p className="text-xs text-muted-foreground">Furmosa 預約</p>
      <h1 className="text-2xl font-semibold text-navy">{merchant.name}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        你預約的是這間店，不是某位美容師。送出後由店家確認。
      </p>

      {!settings.appointmentEnabled ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          這間店還沒開放線上預約。請直接聯繫店家。
        </p>
      ) : (
        <PublicBookForm
          merchantId={merchant.id}
          dateStr={dateStr}
          slots={slots.map((s) => ({
            value: s.startsAt.toISOString(),
            label: formatLocalTime(s.startsAt),
          }))}
          services={services.map((s) => ({
            id: s.id ?? '',
            name: s.name,
          }))}
        />
      )}
    </div>
  );
}
