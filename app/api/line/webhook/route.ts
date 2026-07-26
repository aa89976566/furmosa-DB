import { NextResponse } from 'next/server';
import {
  getLineChannelSecret,
  getLineWebhookEnvChecks,
  isLineWebhookConfigured,
} from '@/lib/line/config';
import { handleLineWebhookEvent, type LineWebhookEvent } from '@/lib/line/handle-event';
import { replyLineFallback } from '@/lib/line/reply';
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
      // 不可靜默：replyToken 還在就一定回一句
      const replyToken =
        'replyToken' in event && typeof event.replyToken === 'string'
          ? event.replyToken
          : undefined;
      await replyLineFallback(replyToken);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: '匠寵 LINE Webhook（請在 LINE Developers 使用 POST）',
    configured: isLineWebhookConfigured(),
    checks: getLineWebhookEnvChecks(),
  });
}
