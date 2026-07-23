import { NextResponse } from 'next/server';
import { maintainShipmentQueueIntegrity } from '@/lib/shipment-queue-filters';
import { syncUpcomingSubscriptionShipments } from '@/lib/subscription-shipment-sync';
import { ensureZhuwoConsignmentBranches } from '@/lib/stores/ensure-zhuwo-merchants';
import { ensureQimuDeliveryShipping } from '@/lib/stores/ensure-qimu-delivery';
import { clearJobThrottle } from '@/lib/job-throttle';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

/** 定期整理出貨佇列／訂閱同步／店家 ensure（不再綁在每次讀頁） */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
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

  return NextResponse.json({
    ok: true,
    subscriptionSync,
    zhuwoCreated: zhuwo.filter((r) => r.created).length,
    qimu,
  });
}

export async function POST(req: Request) {
  return GET(req);
}
