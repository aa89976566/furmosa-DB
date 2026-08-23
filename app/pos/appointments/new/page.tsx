import Link from 'next/link';
import {
  getAuthenticatedMerchantId,
  requireMerchantSession,
} from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import {
  formatLocalDate,
  formatLocalTime,
} from '@/lib/booking/availability';
import {
  listServiceProductsForBooking,
  listSlotsForDay,
} from '@/lib/booking/service';
import { ManualAppointmentForm } from './manual-form';

export const metadata = { title: '手動新增預約 · Furmosa 店家' };

export default async function PosAppointmentNewPage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const dateStr = searchParams?.date || formatLocalDate(new Date());
  const slots = await listSlotsForDay({
    merchantId,
    dateStr,
    audience: 'merchant',
  });
  const services = await listServiceProductsForBooking();

  return (
    <PosShell>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/pos/appointments" className="text-sm text-muted-foreground">
          ← 預約
        </Link>
        <header className="mb-5 border-b border-[#e7e5e4] pb-5">
          <h1 className="mt-2 text-2xl font-semibold">新增預約</h1>
          <p className="mt-1 text-sm text-muted-foreground">已滿時段仍可由門市加開，並會清楚標記。</p>
        </header>
        <ManualAppointmentForm
          dateStr={dateStr}
          slots={slots.map((s) => ({
            value: s.startsAt.toISOString(),
            label: `${formatLocalTime(s.startsAt)}${s.isFull ? '（已滿・可加開）' : ''}`,
          }))}
          services={services.map((s) => ({
            id: s.id ?? '',
            name: s.name,
          }))}
        />
      </div>
    </PosShell>
  );
}
