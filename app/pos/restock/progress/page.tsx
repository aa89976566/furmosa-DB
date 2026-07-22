import Link from 'next/link';
import { requireMerchantSession, getAuthenticatedMerchantId } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import {
  restockRequestTypeLabel,
  restockStatusLabelForMerchant,
} from '@/lib/restock-request/constants';
import { PosShell } from '@/components/pos/pos-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '申請進度 · Furmosa 店家' };

export default async function PosRestockProgressPage() {
  await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();

  const rows = await prisma.restockRequest.findMany({
    where: { merchantId },
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
      <div className="px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Link href="/pos/restock" className="text-xs text-muted-foreground">
              ← 叫貨
            </Link>
            <h1 className="text-xl font-semibold text-navy">申請進度</h1>
          </div>
          <Button asChild className="min-h-[44px]">
            <Link href="/pos/restock/new">新增申請</Link>
          </Button>
        </div>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>還沒有補貨申請。</p>
              <Button asChild className="min-h-[44px] w-full">
                <Link href="/pos/restock/new">去叫貨</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <Link key={r.id} href={`/pos/restock/${r.id}`}>
                <Card className="shadow-card transition hover:border-primary/30">
                  <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {restockRequestTypeLabel(r.requestType)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.createdAt.toLocaleString('zh-TW')}
                        {r.expectedArrivalDate
                          ? ` · 預計到貨 ${r.expectedArrivalDate.toLocaleDateString('zh-TW')}`
                          : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                      {restockStatusLabelForMerchant(r.status)}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PosShell>
  );
}
