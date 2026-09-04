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
import { loadPosAccount } from '@/lib/pos/account';

export const metadata = { title: '補貨單 · Furmosa 店家' };

export default async function PosRestockProgressPage() {
  const session = await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const account = await loadPosAccount(session.merchantId, session.username);

  const [requests, directShipments] = await Promise.all([
    prisma.restockRequest.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        requestType: true,
        status: true,
        createdAt: true,
        expectedArrivalDate: true,
        shipment: { select: { status: true, updatedAt: true } },
      },
    }),
    prisma.shipment.findMany({
      where: { merchantId, type: 'merchant_restock', restockRequest: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, status: true, createdAt: true, shipmentNumber: true },
    }),
  ]);
  const rows = [
    ...requests.map((row) => ({
      ...row,
      href: `/pos/restock/${row.id}`,
      title: restockRequestTypeLabel(row.requestType),
    })),
    ...directShipments.map((row) => ({
      id: row.id,
      requestType: 'HQ_DIRECT',
      status: 'converted_to_shipment',
      createdAt: row.createdAt,
      expectedArrivalDate: null,
      shipment: { status: row.status, updatedAt: row.createdAt },
      href: `/pos/restock/shipment/${row.id}`,
      title: `HQ 主動補貨 · ${row.shipmentNumber}`,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50);

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Link href="/pos/restock" className="text-xs text-muted-foreground">
              ← 補貨
            </Link>
            <h1 className="text-xl font-semibold text-navy">補貨單</h1>
          </div>
          <Button asChild className="min-h-[44px]">
            <Link href="/pos/restock">新增補貨</Link>
          </Button>
        </div>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>還沒有補貨申請。</p>
              <Button asChild className="min-h-[44px] w-full">
                <Link href="/pos/restock">去補貨</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <Link key={`${r.requestType}-${r.id}`} href={r.href}>
                <Card className="shadow-card transition hover:border-primary/30">
                  <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {r.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.createdAt.toLocaleString('zh-TW')}
                        {r.expectedArrivalDate
                          ? ` · 預計到貨 ${r.expectedArrivalDate.toLocaleDateString('zh-TW')}`
                          : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                      {r.shipment?.status === 'pending'
                        ? '等待備貨'
                        : r.shipment?.status === 'packed'
                          ? '已備妥'
                          : r.shipment?.status === 'shipped'
                            ? '運送中'
                            : r.shipment?.status === 'delivered'
                              ? '待確認收貨'
                              : r.shipment?.status === 'received'
                                ? '已完成'
                                : r.shipment?.status === 'cancelled'
                                  ? '已取消'
                                  : restockStatusLabelForMerchant(r.status)}
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
