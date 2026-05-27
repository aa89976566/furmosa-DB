import { NextResponse } from 'next/server';
import { getLineChannelSecret, isLineWebhookConfigured } from '@/lib/line/config';
import { handleLineWebhookEvent, type LineWebhookEvent } from '@/lib/line/handle-event';
import { verifyLineSignature } from '@/lib/line/verify-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isLineWebhookConfigured()) {
    return NextResponse.json({ error: 'LINE webhook 未設定' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature');

  let secret: string;
  try {
    secret = getLineChannelSecret();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '設定錯誤' },
      { status: 503 },
    );
  }

  if (!verifyLineSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: '簽章驗證失敗' }, { status: 401 });
  }

  let payload: { events?: LineWebhookEvent[] };
  try {
    payload = JSON.parse(rawBody) as { events?: LineWebhookEvent[] };
  } catch {
    return NextResponse.json({ error: 'JSON 格式錯誤' }, { status: 400 });
  }

  const events = payload.events ?? [];
  for (const event of events) {
    try {
      await handleLineWebhookEvent(event);
    } catch (e) {
      console.error('[line/webhook] event error', e);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: '匠寵 LINE Webhook（請在 LINE Developers 使用 POST）',
    configured: isLineWebhookConfigured(),
  });
}
