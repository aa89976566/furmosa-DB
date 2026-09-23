import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CheckCircle2, Circle, PackageCheck, Truck } from 'lucide-react';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadMerchantRestockShipment, loadNewerMerchantRestockShipment } from '@/lib/pos/load-merchant-restock-shipment';
import { loadPosAccount } from '@/lib/pos/account';
import { PosShell } from '@/components/pos/pos-shell';
import { ReceiptManifest } from './receipt-manifest';

export const metadata = { title: '出貨單 · Furmosa 店家' };

const RECEIPT_MESSAGE: Record<string, { text: string; failed: boolean }> = {
  just_received: { text: '已確認收貨，商品已加入店內庫存。', failed: false },
  already_received: { text: '這筆補貨已完成收貨。', failed: false },
  failed: { text: '現在不能確認收貨，請再試一次。', failed: true },
};

function formatDate(value: Date | null) {
  if (!value) return '尚未更新';
  return value.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export default async function PosDirectShipmentPage(
  props: { params: Promise<{ id: string }>; searchParams?: Promise<{ receipt?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await requireMerchantSession();
  const merchantId = session.merchantId;
  const [account, loaded] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadMerchantRestockShipment(params.id, merchantId),
  ]);
  if (!loaded) notFound();
  if (loaded.kind === 'linked_request') redirect(`/pos/restock/${loaded.requestId}`);

  const shipment = loaded.shipment;
  const newerShipment = await loadNewerMerchantRestockShipment(merchantId, shipment.id);
  const shipmentCopy = {
    pending: { label: '等待備貨', help: '匠寵正在安排商品與出貨。' },
    packed: { label: '商品已備妥', help: '商品已完成備貨，準備交給物流。' },
    shipped: { label: '運送中', help: '商品已由匠寵寄出，請留意物流進度。' },
    delivered: { label: '待確認收貨', help: '請逐項核對這批商品後確認入庫。' },
    received: { label: '已確認收貨', help: '商品已加入店家可售庫存。' },
    cancelled: { label: '出貨已取消', help: '請查看回覆或聯絡匠寵。' },
  }[shipment.status];
  const canConfirmReceipt = shipment.status === 'shipped' || shipment.status === 'delivered';
  const receipt = searchParams?.receipt ? RECEIPT_MESSAGE[searchParams.receipt] : null;
  const timeline = [
    { label: '完成備貨', date: shipment.packedAt, done: Boolean(shipment.packedAt) },
    { label: '商品出貨', date: shipment.shippedAt, done: Boolean(shipment.shippedAt) },
    { label: '物流送達', date: shipment.deliveredAt, done: Boolean(shipment.deliveredAt) },
    { label: '店家確認收貨', date: null, done: shipment.status === 'received' },
  ];

  return (
    <PosShell storeName={account.storeName} account={account} wide>
      <main className="h-full overflow-y-auto px-4 py-6 md:px-7 md:py-8">
        <div className="mx-auto w-full max-w-[1380px] pb-12">
          <Link href="/pos/notifications" className="inline-flex items-center rounded-lg px-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">返回通知</Link>
          <div className="mt-4 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-medium text-primary">匠寵直接配送</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">出貨單 {shipment.shipmentNumber}</h1><p className="mt-2 text-sm text-muted-foreground">{shipmentCopy?.help ?? '請依出貨狀態處理。'}</p></div>
            <span className="w-fit rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">{shipmentCopy?.label ?? shipment.status}</span>
          </div>
          {receipt ? <p role={receipt.failed ? 'alert' : 'status'} aria-live="polite" className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${receipt.failed ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/20 bg-primary/10 font-medium text-primary'}`}>{receipt.text}</p> : null}
          {newerShipment ? <Link href={`/pos/shipments/${newerShipment.id}`} className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm transition-colors hover:bg-primary/15"><span><span className="block font-medium text-primary">這是較早的出貨單</span><span className="mt-0.5 block text-muted-foreground">HQ 最近寄出的是 {newerShipment.shipmentNumber}，請前往查看最新明細。</span></span><span className="shrink-0 font-medium text-primary">查看最新單</span></Link> : null}
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <ReceiptManifest shipmentId={shipment.id} items={shipment.items} canConfirmReceipt={canConfirmReceipt} />
            <aside className="space-y-5">
              <section className="rounded-3xl border border-border bg-card p-5 shadow-[0_16px_44px_rgba(22,50,37,0.06)]"><div className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" aria-hidden /><h2 className="font-semibold">出貨資訊</h2></div><dl className="mt-5 space-y-4 text-sm"><div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">配送方式</dt><dd className="text-right font-medium">{shipment.carrier ?? '匠寵安排配送'}</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">追蹤編號</dt><dd className="break-all text-right font-medium">{shipment.trackingNumber ?? '尚未提供'}</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">出貨單號</dt><dd className="text-right font-medium">{shipment.shipmentNumber}</dd></div></dl></section>
              <section className="rounded-3xl border border-border bg-card p-5 shadow-[0_16px_44px_rgba(22,50,37,0.06)]"><div className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-primary" aria-hidden /><h2 className="font-semibold">收貨進度</h2></div><ol className="mt-5 space-y-5">{timeline.map((step, index) => <li key={step.label} className="relative flex gap-3">{index < timeline.length - 1 ? <span className={`absolute left-[11px] top-6 h-[calc(100%+4px)] w-px ${step.done ? 'bg-primary/45' : 'bg-border'}`} aria-hidden /> : null}<span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'}`}>{step.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}</span><span className="min-w-0 pb-1"><span className={`block text-sm font-medium ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span><span className="mt-1 block text-xs text-muted-foreground">{step.done ? formatDate(step.date) : '等待處理'}</span></span></li>)}</ol></section>
            </aside>
          </div>
        </div>
      </main>
    </PosShell>
  );
}
