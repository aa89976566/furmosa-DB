import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sinceRaw = req.nextUrl.searchParams.get('since');
  const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 5 * 60 * 1000);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: 'Invalid since' }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: {
      orderedAt: { gt: since },
      status: { not: 'cancelled' },
    },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      source: true,
      orderedAt: true,
    },
    orderBy: { orderedAt: 'asc' },
    take: 20,
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: Number(o.total),
      source: o.source,
      orderedAt: o.orderedAt.toISOString(),
    })),
    serverTime: new Date().toISOString(),
  });
}
