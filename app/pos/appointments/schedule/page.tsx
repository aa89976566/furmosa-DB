import Link from 'next/link';
import {
  getAuthenticatedMerchantId,
  requireMerchantSession,
} from '@/lib/merchant-auth';
import { PosShell } from '@/components/pos/pos-shell';
import { ensureMerchantSettings } from '@/lib/restock-request/service';
import { ScheduleForm } from './schedule-form';

export const metadata = { title: '共用班表 · Furmosa 店家' };

export default async function PosBookingSchedulePage() {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const settings = await ensureMerchantSettings(merchantId);

  return (
    <PosShell>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/pos/appointments" className="text-sm text-muted-foreground">
          ← 預約
        </Link>
        <header className="mb-5 border-b border-[#e7e5e4] pb-5">
          <h1 className="mt-2 text-2xl font-semibold">門市預約時段</h1>
          <p className="mt-1 text-sm text-muted-foreground">設定本店可接受預約的時間與每個時段容量。</p>
        </header>
        <ScheduleForm
          openTime={settings.bookingOpenTime}
          closeTime={settings.bookingCloseTime}
          slotMinutes={settings.bookingSlotMinutes}
          capacityPerSlot={settings.bookingCapacityPerSlot}
          weekdays={settings.bookingWeekdays}
          bookingNotifyLineUserId={settings.bookingNotifyLineUserId ?? ''}
        />
      </div>
    </PosShell>
  );
}
