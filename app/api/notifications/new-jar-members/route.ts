import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** HQ 輪詢：自 since 之後新開通換罐的會員（對齊訂單鈴鐺模式） */
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

  const rows = await prisma.customerService.findMany({
    where: {
      serviceType: 'jar_exchange',
      serviceStatus: 'active',
      startedAt: { gt: since },
    },
    select: {
      startedAt: true,
      customer: {
        select: {
          id: true,
          customerId: true,
          name: true,
          petName: true,
          lineUserId: true,
        },
      },
    },
    orderBy: { startedAt: 'asc' },
    take: 20,
  });

  return NextResponse.json({
    members: rows.map((row) => ({
      id: row.customer.id,
      customerCode: row.customer.customerId,
      name: row.customer.name,
      petName: row.customer.petName,
      hasLine: Boolean(row.customer.lineUserId),
      startedAt: row.startedAt.toISOString(),
    })),
    serverTime: new Date().toISOString(),
  });
}
