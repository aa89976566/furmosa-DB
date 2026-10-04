import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { safeAvailableJarCodeWhere, JAR_CODE_ORDER } from '@/lib/jar-exchange/code-management';
import { buildCodesXlsx } from '@/lib/jar-exchange/codes-xlsx';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!await getCurrentUser()) return NextResponse.json({ error: '請先登入 HQ' }, { status: 401 });
  const batch = new URL(req.url).searchParams.get('batch')?.trim();
  const rows = await prisma.$transaction(async tx => {
    const where = await safeAvailableJarCodeWhere(tx);
    return tx.jarCode.findMany({ where: { AND: [where, ...(batch ? [{ batchNo: batch }] : [])] }, orderBy: JAR_CODE_ORDER, select: { code: true, batchNo: true } });
  }, { isolationLevel: 'RepeatableRead' });
  const unique = [...new Map(rows.filter(row => /^\d{8}$/.test(row.code)).map(row => [row.code, row])).values()];
  return new NextResponse(new Uint8Array(buildCodesXlsx(unique)), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': 'attachment; filename="available-jar-codes.xlsx"',
    'Cache-Control': 'no-store',
  } });
}
