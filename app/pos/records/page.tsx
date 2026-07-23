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
      <div className="px-4 py-6">
        <h1 className="mb-1 text-xl font-semibold text-navy">紀錄</h1>
        <p className="mb-5 text-sm text-muted-foreground">今天的叫貨紀錄</p>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>今天還沒有叫貨紀錄。</p>
              <p>美容與換罐紀錄會在對應功能上線後再顯示，不會先放假資料。</p>
              <Button asChild variant="outline" className="min-h-[44px] w-full">
                <Link href="/pos/restock">去叫貨</Link>
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
                        {r.createdAt.toLocaleTimeString('zh-TW', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
