import { NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/cron-auth';
import { runMorningDryRun } from '@/lib/line/morning/runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Preview MVP dry-run endpoint。
 * - 需 CRON_SECRET（Preview／Production）
 * - 不真送 LINE
 * - 未加入 vercel.json（避免 Production 自動排程）
 */
export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? '100') || 100));
  const enforceWindow = url.searchParams.get('enforceWindow') === '1';
  const enforceSlot = url.searchParams.get('enforceSlot') === '1';

  try {
    const summary = await runMorningDryRun({
      limit,
      enforceWindow,
      enforceSlot,
      markUsed: false,
    });
    return NextResponse.json({
      ok: true,
      ...summary,
      planned: summary.planned.slice(0, 50),
      plannedTotal: summary.planned.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[cron/line-morning-dry-run]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
