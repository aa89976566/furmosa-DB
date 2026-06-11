import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isWebPushConfigured } from '@/lib/web-push';

type PushSubscriptionJson = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: 'Web Push 未設定' }, { status: 503 });
  }

  const body = (await req.json()) as PushSubscriptionJson;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await prisma.userPushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      userId: user.userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: req.headers.get('user-agent'),
    },
    update: {
      userId: user.userId,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: req.headers.get('user-agent'),
    },
  });

  return NextResponse.json({ ok: true });
}
