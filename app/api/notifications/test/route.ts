import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendTestPush } from '@/lib/web-push';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendTestPush(user.userId);
  if (!result.configured) {
    return NextResponse.json({ error: '手機推播尚未設定' }, { status: 503 });
  }
  if (result.attempted === 0) {
    return NextResponse.json(
      { error: '目前帳號尚未有已訂閱的裝置' },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: result.delivered > 0,
    attempted: result.attempted,
    delivered: result.delivered,
  });
}
