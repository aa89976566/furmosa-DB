import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { endpoint?: string };
  const endpoint = body?.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  await prisma.userPushSubscription.deleteMany({
    where: { userId: user.userId, endpoint },
  });

  return NextResponse.json({ ok: true });
}
