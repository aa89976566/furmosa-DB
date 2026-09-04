import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAuthenticatedMerchantId, requireMerchantSession } from '@/lib/merchant-auth';
import { prisma } from '@/lib/prisma';
import { loadPosAccount } from '@/lib/pos/account';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { confirmRestockReceiptAction } from '../../[id]/actions';

export const metadata = { title: 'HQ 主動補貨 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

const statusCopy: Record<string, { label: string; help: string }> = {
  pending: { label: 'HQ 已建立，等待備貨', help: 'HQ 正在安排商品與出貨。' },
  packed: { label: '商品已備妥', help: '商品已完成備貨，準備交給物流。' },
  shipped: { label: '商品運送中', help: '商品已離開 HQ，請留意物流進度。' },
  delivered: { label: '商品已送達，請驗收', help: '確認品項與數量正確後再完成收貨。' },
  received: { label: '店家已確認收貨', help: '商品已加入店家可售庫存。' },
  cancelled: { label: '出貨已取消', help: '請聯絡 HQ 確認原因。' },
};

export default async function PosDirectRestockShipmentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { received?: string };
}) {
  const session = await requireMerchantSession();
  const merchantId = await getAuthenticatedMerchantId();
  const [account, shipment] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    prisma.shipment.findFirst({
      where: {
        id: params.id,
        merchantId,
        type: 'merchant_restock',
        restockRequest: null,
      },
      include: { items: true },
    }),
  ]);
  if (!shipment) notFound();

  const copy = statusCopy[shipment.status] ?? {
    label: shipment.status,
    help: '請聯絡 HQ 確認目前進度。',
  };

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="space-y-4 px-4 py-6">
        <Link href="/pos/restock/progress" className="text-xs text-muted-foreground">
          ← 補貨進度
        </Link>

        {searchParams?.received === '1' ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <p className="font-medium">收貨完成</p>
            <p>商品已加入店家庫存。</p>
          </div>
        ) : null}

        <div>
          <h1 className="text-xl font-semibold text-navy">HQ 主動補貨</h1>
          <p className="text-sm text-muted-foreground">出貨單 {shipment.shipmentNumber}</p>
        </div>

        <Card className={shipment.status === 'delivered' ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="font-semibold">{copy.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{copy.help}</p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">配送方式</dt><dd className="font-medium">{shipment.carrier ?? '尚未指定'}</dd></div>
              <div><dt className="text-muted-foreground">追蹤編號</dt><dd className="font-medium">{shipment.trackingNumber ?? '尚未提供'}</dd></div>
            </dl>
            {shipment.status === 'delivered' ? (
              <form action={confirmRestockReceiptAction}>
                <input type="hidden" name="shipmentId" value={shipment.id} />
                <Button type="submit" className="min-h-[48px] w-full">
                  確認品項正確並完成收貨
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold">補貨品項</h2>
            <ul className="mt-3 divide-y divide-border/60">
              {shipment.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div><p className="font-medium">{item.productName}</p><p className="font-mono text-xs text-muted-foreground">{item.sku}</p></div>
                  <span className="tabular-nums">× {item.quantity}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </PosShell>
  );
}
