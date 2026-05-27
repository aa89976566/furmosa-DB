import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PrintActions } from '@/components/jar-exchange/print-actions';
import { filterValidJarCodes } from '@/lib/jar-exchange/codes';
import {
  COLS,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  LABELS_PER_PAGE,
  ROWS,
  chunkForPrint,
} from '@/lib/jar-exchange/print-labels';

export const dynamic = 'force-dynamic';

export default async function JarCodesPrintPage({
  searchParams,
}: {
  searchParams?: { batch?: string; status?: string; all?: string; limit?: string };
}) {
  const batch = (searchParams?.batch ?? '').trim();
  const status =
    searchParams?.status === 'used' || searchParams?.status === 'unused'
      ? searchParams.status
      : 'unused';
  const all = searchParams?.all === '1';
  const limitRaw = parseInt(searchParams?.limit ?? '', 10);
  const limit = all
    ? undefined
    : Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 500)
      : LABELS_PER_PAGE;

  if (!batch) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-neutral-600">
        <p>請提供批次編號，例如：</p>
        <p className="mt-2 font-mono text-xs">/jar-exchange/codes?batch=BATCH-20260524</p>
        <Link href="/jar-exchange/manage?tab=codes" className="mt-4 inline-block text-primary underline">
          返回序號管理
        </Link>
      </div>
    );
  }

  const [codes, totalInBatch] = await Promise.all([
    prisma.jarCode.findMany({
      where: { batchNo: batch, status },
      orderBy: { createdAt: 'asc' },
      select: { code: true },
      ...(limit !== undefined ? { take: limit } : {}),
    }),
    prisma.jarCode.count({ where: { batchNo: batch, status } }),
  ]);

  const numericCodes = filterValidJarCodes(codes.map((c) => c.code));
  if (numericCodes.length === 0) notFound();

  const pages = chunkForPrint(numericCodes);
  const truncated = limit !== undefined && totalInBatch > numericCodes.length;

  return (
    <>
      <PrintActions
        batch={batch}
        count={numericCodes.length}
        totalInBatch={totalInBatch}
        truncated={truncated}
        showAll={all}
        pageCount={pages.length}
        cols={COLS}
        rows={ROWS}
        perPage={LABELS_PER_PAGE}
      />

      <div className="print-root mx-auto py-6 print:py-0">
        {pages.map((pageCodes, pageIndex) => (
          <section
            key={pageIndex}
            className="print-sheet mx-auto mb-6 bg-white shadow-md print:mb-0 print:shadow-none"
            style={{
              width: '210mm',
              minHeight: '297mm',
              padding: '5mm',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${COLS}, ${LABEL_WIDTH_MM}mm)`,
                gridAutoRows: `${LABEL_HEIGHT_MM}mm`,
                width: `${COLS * LABEL_WIDTH_MM}mm`,
              }}
            >
              {pageCodes.map((code) => (
                <div
                  key={code}
                  style={{
                    width: `${LABEL_WIDTH_MM}mm`,
                    height: `${LABEL_HEIGHT_MM}mm`,
                    boxSizing: 'border-box',
                    border: '0.15mm dashed #999',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '11pt',
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {code}
                  </span>
                </div>
              ))}
            </div>
            <p className="no-print mt-2 text-center text-[10px] text-neutral-400">
              第 {pageIndex + 1} / {pages.length} 頁
            </p>
          </section>
        ))}
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-root { padding: 0 !important; }
          .print-sheet {
            page-break-after: always;
            break-after: page;
            margin: 0 auto !important;
            box-shadow: none !important;
          }
          .print-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </>
  );
}
