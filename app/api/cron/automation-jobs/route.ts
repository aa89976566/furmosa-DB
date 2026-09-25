import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/cron-auth';
import { processDueAutomationJobs } from '@/lib/automation/line-jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await processDueAutomationJobs(20);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/automation-jobs]', error);
    return NextResponse.json(
      { ok: false, error: '自動修復暫時無法執行' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
