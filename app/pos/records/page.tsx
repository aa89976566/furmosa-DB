import Link from 'next/link';
import { requireMerchantSession, getAuthenticatedMerchantId } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import {
  restockRequestTypeLabel,
  restockStatusLabelForMerchant,
} from '@/lib/restock-request/constants';
import { PosShell } from '@/components/pos/pos-shell';
import { Button } from '@/components/ui/button';

export const metadata = { title: '紀錄 · Furmosa 店家' };

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function PosRecordsPage() {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const since = startOfTodayLocal();

  const rows = await prisma.restockRequest.findMany({
    where: {
      merchantId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      requestType: true,
      status: true,
      createdAt: true,
      expectedArrivalDate: true,
    },
  });

  return (
    <PosShell>
      <div className="px-5 pb-4 pt-8">
        <header className="mb-8">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-sage">
            Furmosa
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">紀錄</h1>
          <p className="mt-1 text-sm text-muted-foreground">今天的叫貨</p>
        </header>

        {rows.length === 0 ? (
          <section className="space-y-5 py-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              今天還沒有叫貨。
            </p>
            <Button asChild className="min-h-[48px] w-full text-base">
              <Link href="/pos/restock">去叫貨</Link>
            </Button>
          </section>
        ) : (
          <div className="divide-y divide-border/70">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/pos/restock/${r.id}`}
                className="flex min-h-[64px] items-center justify-between gap-3 py-4 first:pt-1"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {restockRequestTypeLabel(r.requestType)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.createdAt.toLocaleTimeString('zh-TW', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {r.expectedArrivalDate
                      ? ` · 預計 ${r.expectedArrivalDate.toLocaleDateString('zh-TW')}`
                      : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-sage">
                  {restockStatusLabelForMerchant(r.status)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PosShell>
  );
}
