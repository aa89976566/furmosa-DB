import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  repairCustomerShipping,
  summarizeRepairResult,
} from '@/lib/orders/repair-customer-shipping';

/**
 * HQ 登入後可呼叫。預設 dry-run，不寫入。
 * 套用：POST /api/admin/customer-shipping-repair?apply=1
 * 不回傳姓名、電話、地址。
 */
export async function GET(request: Request) {
  return run(request, true);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const apply = url.searchParams.get('apply') === '1';
  return run(request, !apply);
}

async function run(_request: Request, dryRun: boolean) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: '未登入' }, { status: 401 });
  }

  const result = await repairCustomerShipping({ dryRun });
  return NextResponse.json({
    ok: true,
    ...summarizeRepairResult(result),
  });
}
