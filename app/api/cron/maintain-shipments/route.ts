import { NextResponse } from 'next/server';
import { refreshDashboardKpiSnapshot } from '@/features/dashboard/queries';
import { authorizeCronRequest } from '@/lib/cron-auth';
import { maintainShipmentQueueIntegrity } from '@/lib/shipment-queue-filters';
import { syncUpcomingSubscriptionShipments } from '@/lib/subscription-shipment-sync';
import { ensureZhuwoConsignmentBranches } from '@/lib/stores/ensure-zhuwo-merchants';
import { ensureQimuDeliveryShipping } from '@/lib/stores/ensure-qimu-delivery';
import { clearJobThrottle } from '@/lib/job-throttle';
import { processAppointmentReminders } from '@/lib/booking/reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** 定期整理出貨佇列／訂閱同步／店家 ensure（不再綁在每次讀頁） */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  clearJobThrottle();

  const [subscriptionSync, zhuwo, qimu] = await Promise.all([
    syncUpcomingSubscriptionShipments(28),
    ensureZhuwoConsignmentBranches().catch((error) => {
      console.error('[cron/maintain-shipments] ensureZhuwo', error);
      return [];
    }),
    ensureQimuDeliveryShipping().catch((error) => {
      console.error('[cron/maintain-shipments] ensureQimu', error);
      return null;
    }),
  ]);

  await maintainShipmentQueueIntegrity();

  let dashboardKpi: { ok: true; computedAt: string } | { ok: false; error: string };
  try {
    await refreshDashboardKpiSnapshot();
    dashboardKpi = { ok: true, computedAt: new Date().toISOString() };
  } catch (error) {
    console.error('[cron/maintain-shipments] dashboard kpi', error);
    dashboardKpi = {
      ok: false,
      error: error instanceof Error ? error.message : 'kpi refresh failed',
    };
  }

  // Booking Round 2：T−1d（日曆明天）＋掃一次 T−2h；Hobby 不可 hourly cron
  const bookingReminders = await processAppointmentReminders().catch((error) => {
    console.error('[cron/maintain-shipments] bookingReminders', error);
    return { error: String(error) };
  });

  return NextResponse.json({
    ok: true,
    subscriptionSync,
    zhuwoCreated: zhuwo.filter((r) => r.created).length,
    qimu,
    dashboardKpi,
    bookingReminders,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
