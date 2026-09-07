import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadMerchantRestockShipment } from '@/lib/pos/load-merchant-restock-shipment';
import { loadPosAccount } from '@/lib/pos/account';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { confirmDirectShipmentReceiptAction } from './actions';

export const metadata = { title: '出貨單 · Furmosa 店家' };

const RECEIPT_MESSAGE: Record<string, { text: string; failed: boolean }> = {
  just_received: { text: '已確認收貨，商品已加入店內庫存。', failed: false },
  already_received: { text: '這筆補貨已完成收貨。', failed: false },
  failed: { text: '現在不能確認收貨，請再試一次。', failed: true },
};

export default async function PosDirectShipmentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { receipt?: string };
}) {
  const session = await requireMerchantSession();
  const merchantId = session.merchantId;
  const [account, loaded] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadMerchantRestockShipment(params.id, merchantId),
  ]);
  if (!loaded) notFound();
  if (loaded.kind === 'linked_request') {
    redirect(`/pos/restock/${loaded.requestId}`);
  }

  const shipment = loaded.shipment;
  const shipmentCopy = {
    pending: { label: 'HQ 已建立出貨單，等待備貨', help: 'HQ 正在安排商品與出貨。' },
    packed: { label: '商品已備妥', help: '商品已完成備貨，準備交給物流。' },
    shipped: { label: '商品運送中', help: '商品已離開 HQ，請留意物流進度。' },
    delivered: { label: '待確認收貨', help: '請核對這批商品，再確認收到貨。' },
    received: { label: '店家已確認收貨', help: '商品已加入店家可售庫存。' },
    cancelled: { label: '出貨已取消', help: '請查看公司回覆或聯絡 HQ。' },
  }[shipment.status];
  const shipmentTimeline = [
    { label: '完成備貨', done: Boolean(shipment.packedAt) },
    { label: '商品出貨', done: Boolean(shipment.shippedAt) },
    { label: '物流送達', done: Boolean(shipment.deliveredAt) },
    { label: '店家確認收貨', done: shipment.status === 'received' },
  ];
  const receipt = searchParams?.receipt ? RECEIPT_MESSAGE[searchParams.receipt] : null;

  return (
    <PosShell storeName={account.storeName} account={account}>
      <div className="space-y-4 px-4 py-6">
        <Link href="/pos/notifications" className="text-xs text-muted-foreground">
          ← 通知
        </Link>

        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">HQ 直接配送｜非本店申請</p>
          <p className="mt-1 text-muted-foreground">如品項或數量不符，請先聯絡 HQ</p>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-navy">出貨單</h1>
            <p className="text-sm text-muted-foreground">{shipment.shipmentNumber}</p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            {shipmentCopy?.label ?? shipment.status}
          </span>
        </div>

        {receipt ? (
          <p
            role={receipt.failed ? 'alert' : 'status'}
            aria-live="polite"
            className={receipt.failed ? 'text-sm text-destructive' : 'text-sm font-medium'}
          >
            {receipt.text}
          </p>
        ) : null}

        <Card className={shipment.status === 'delivered' ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="font-semibold">{shipmentCopy?.label ?? '出貨狀態'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {shipmentCopy?.help ?? '請依出貨狀態處理。'}
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">出貨單</span>
                <br />
                <span className="font-medium">{shipment.shipmentNumber}</span>
              </p>
              {shipment.carrier ? (
                <p>
                  <span className="text-muted-foreground">配送方式</span>
                  <br />
                  <span className="font-medium">{shipment.carrier}</span>
                </p>
              ) : null}
              {shipment.trackingNumber ? (
                <p>
                  <span className="text-muted-foreground">追蹤編號</span>
                  <br />
                  <span className="font-medium">{shipment.trackingNumber}</span>
                </p>
              ) : null}
            </div>

            {shipment.status === 'delivered' ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-background/70 p-3 text-sm">
                  <p className="font-medium">請先核對品項、數量與商品狀況。</p>
                  <p className="mt-1 text-muted-foreground">
                    如品項或數量不符，請先聯絡 HQ，先不要確認。
                  </p>
                </div>
                <form action={confirmDirectShipmentReceiptAction}>
                  <input type="hidden" name="shipmentId" value={shipment.id} />
                  <Button type="submit" className="min-h-[48px] w-full">
                    確認收到貨
                  </Button>
                </form>
              </div>
            ) : null}

            <div className="border-t pt-3">
              <p className="mb-3 text-sm font-medium">處理進度</p>
              <ol className="grid gap-2 sm:grid-cols-4">
                {shipmentTimeline.map((step) => (
                  <li key={step.label} className="flex items-center gap-2 text-sm sm:block">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        step.done
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step.done ? '✓' : '·'}
                    </span>
                    <span className="sm:mt-2 sm:block">{step.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">出貨明細</p>
            {shipment.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚未加入出貨品項</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {shipment.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span className="min-w-0 break-words">{item.productName}</span>
                    <span className="shrink-0 font-medium">{item.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PosShell>
  );
}
