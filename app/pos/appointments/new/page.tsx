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
      <div className="px-4 py-6">
        <Link href="/pos/appointments" className="text-xs text-muted-foreground">
          ← 預約
        </Link>
        <h1 className="mb-1 text-xl font-semibold text-navy">手動新增</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          可寫入已滿時段（超約）。顧客公開頁看不到已滿格。
        </p>
        <ManualAppointmentForm
          dateStr={dateStr}
          slots={slots.map((s) => ({
            value: s.startsAt.toISOString(),
            label: `${formatLocalTime(s.startsAt)}${s.isFull ? '（已滿・超約）' : ''}`,
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
