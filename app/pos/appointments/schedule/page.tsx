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
      <div className="px-4 py-6">
        <Link href="/pos/appointments" className="text-xs text-muted-foreground">
          ← 預約
        </Link>
        <h1 className="mb-1 text-xl font-semibold text-navy">共用班表</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          設定本店可預約時段。不是設定 Amy／Tony 個人班。
        </p>
        <ScheduleForm
          openTime={settings.bookingOpenTime}
          closeTime={settings.bookingCloseTime}
          slotMinutes={settings.bookingSlotMinutes}
          capacityPerSlot={settings.bookingCapacityPerSlot}
          weekdays={settings.bookingWeekdays}
        />
      </div>
    </PosShell>
  );
}
