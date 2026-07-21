import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureZhuwoConsignmentBranches } from '@/lib/stores/ensure-zhuwo-merchants';

/** 登入後可呼叫：強制補齊豬窩三間分店並回傳現況 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: '未登入' }, { status: 401 });
  }

  const ensured = await ensureZhuwoConsignmentBranches();
  const merchants = await prisma.merchant.findMany({
    where: {
      OR: [
        { name: { contains: '豬窩' } },
        { merchantId: { in: ['MER-0016', 'MER-0019', 'MER-0020'] } },
      ],
    },
    select: { merchantId: true, name: true, status: true, types: true },
    orderBy: { merchantId: 'asc' },
  });

  return NextResponse.json({ ok: true, ensured, merchants });
}

export async function GET() {
  return POST();
}
