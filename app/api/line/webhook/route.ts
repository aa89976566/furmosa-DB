import { NextResponse } from 'next/server';
import {
  getLineChannelSecret,
  getLineWebhookEnvChecks,
  isLineWebhookConfigured,
} from '@/lib/line/config';
import { runAfterReply } from '@/lib/line/defer';
import { handleLineWebhookEvent, type LineWebhookEvent } from '@/lib/line/handle-event';
import { showLineLoadingAnimation } from '@/lib/line/loading';
import { replyLineFallback } from '@/lib/line/reply';
import { verifyLineSignature } from '@/lib/line/verify-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** 開箱報名等路徑含多段 DB；給足時間避免中途被殺 */
export const maxDuration = 30;

function eventUserId(event: LineWebhookEvent): string | undefined {
  if (!('source' in event) || !event.source || typeof event.source !== 'object') {
    return undefined;
  }
  const uid = (event.source as { userId?: string }).userId;
  return typeof uid === 'string' ? uid : undefined;
}

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

  // 感知速度：先顯示 Loading，再做業務（不 await）
  for (const event of events) {
    if (event.type !== 'message' && event.type !== 'postback') continue;
    const uid = eventUserId(event);
    if (uid) void showLineLoadingAnimation(uid, 20);
  }

  for (const event of events) {
    try {
      await handleLineWebhookEvent(event);
    } catch (e) {
      console.error('[line/webhook] event error', e);
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
  // 暖機：連一次 DB，減少下一則 webhook 冷啟動＋連線池開銷
  runAfterReply(
    (async () => {
      try {
        const { prisma } = await import('@/lib/prisma');
        await prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        console.error('[line/webhook] warm db failed', err);
      }
    })(),
  );
  return NextResponse.json({
    ok: true,
    message: '匠寵 LINE Webhook（請在 LINE Developers 使用 POST）',
    configured: isLineWebhookConfigured(),
    checks: getLineWebhookEnvChecks(),
    warm: true,
  });
}
