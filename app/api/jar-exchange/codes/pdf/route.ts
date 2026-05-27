import { NextResponse } from 'next/server';
import { buildJarCodesPdf } from '@/lib/jar-exchange/build-labels-pdf';
import { filterValidJarCodes } from '@/lib/jar-exchange/codes';
import { LABELS_PER_PAGE } from '@/lib/jar-exchange/print-labels';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const batch = (searchParams.get('batch') ?? '').trim();
  const statusParam = searchParams.get('status');
  const status =
    statusParam === 'used' || statusParam === 'unused' ? statusParam : 'unused';

  if (!batch) {
    return NextResponse.json({ error: '缺少 batch 參數' }, { status: 400 });
  }

  const all = searchParams.get('all') === '1';
  const limitRaw = parseInt(searchParams.get('limit') ?? '', 10);
  const limit = all
    ? undefined
    : Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 500)
      : LABELS_PER_PAGE;

  const codes = await prisma.jarCode.findMany({
    where: { batchNo: batch, status },
    orderBy: { createdAt: 'asc' },
    select: { code: true },
    ...(limit !== undefined ? { take: limit } : {}),
  });

  const numericCodes = filterValidJarCodes(codes.map((c) => c.code));

  if (numericCodes.length === 0) {
    return NextResponse.json(
      { error: '此批次沒有可列印的 8 位數字序號（舊 PET- 格式已排除）' },
      { status: 404 },
    );
  }

  const pdfBytes = await buildJarCodesPdf(numericCodes, batch);
  const filename = `jar-codes-${batch.replace(/[^\w-]+/g, '_')}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
