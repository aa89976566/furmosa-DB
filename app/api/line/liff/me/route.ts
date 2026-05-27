import { NextResponse } from 'next/server';
import { getLineMemberDashboard } from '@/lib/line/liff-customer';
import { listActiveRewardsForLine } from '@/lib/line/reward-menu';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken?.trim()) {
      return NextResponse.json({ error: '缺少登入資訊' }, { status: 400 });
    }

    const dashboard = await getLineMemberDashboard(idToken);
    const rewards = dashboard.registered
      ? await listActiveRewardsForLine()
      : [];

    return NextResponse.json({ dashboard, rewards });
  } catch (e) {
    const message = e instanceof Error ? e.message : '讀取失敗';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
