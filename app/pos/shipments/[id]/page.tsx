import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CheckCircle2, Circle, Clock3, PackageCheck, Truck } from 'lucide-react';
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

function formatDate(value: Date | null | undefined) {
  if (!value) return '尚未更新';
  return new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
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
    { label: '店家確認收貨', date: shipment.receivedAt, done: shipment.status === 'received' },
  ];
  const statusTone = shipment.status === 'received' ? 'border-primary/20 bg-primary/10 text-primary' : shipment.status === 'cancelled' ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-amber-300/60 bg-amber-50 text-amber-800';

  return (
    <PosShell storeName={account.storeName} account={account} wide>
      <main className="h-full overflow-y-auto px-4 py-6 md:px-7 md:py-8">
        <div className="mx-auto w-full max-w-[1420px] pb-12">
          <Link href="/pos/notifications" className="inline-flex items-center rounded-lg px-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">返回通知中心</Link>
          <div className="mt-4 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-semibold text-primary">HQ 補貨配送</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">出貨單 {shipment.shipmentNumber}</h1><p className="mt-2 text-sm text-muted-foreground">{shipmentCopy?.help ?? '請依出貨狀態處理。'}</p></div>
            <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold ${statusTone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{shipmentCopy?.label ?? shipment.status}</span>
          </div>
          {receipt ? <p role={receipt.failed ? 'alert' : 'status'} aria-live="polite" className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${receipt.failed ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/20 bg-primary/10 font-medium text-primary'}`}>{receipt.text}</p> : null}
          {newerShipment ? <Link href={`/pos/shipments/${newerShipment.id}`} className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm transition-colors hover:bg-primary/15"><span><span className="block font-medium text-primary">這是較早的出貨單</span><span className="mt-0.5 block text-muted-foreground">HQ 最近寄出的是 {newerShipment.shipmentNumber}，請前往查看最新明細。</span></span><span className="shrink-0 font-medium text-primary">查看最新單</span></Link> : null}
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <ReceiptManifest shipmentId={shipment.id} items={shipment.items} canConfirmReceipt={canConfirmReceipt} />
            <aside className="space-y-5">
              <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[0_18px_48px_rgba(22,50,37,0.07)]"><div className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-base font-semibold">出貨資訊</h2></div><dl className="mt-5 divide-y divide-border/70 text-sm"><div className="flex items-start justify-between gap-4 py-3 pt-0"><dt className="text-muted-foreground">出貨單號</dt><dd className="text-right font-semibold">{shipment.shipmentNumber}</dd></div><div className="flex items-start justify-between gap-4 py-3"><dt className="text-muted-foreground">發貨單位</dt><dd className="text-right font-medium">Furmosa 總公司 HQ</dd></div><div className="flex items-start justify-between gap-4 py-3"><dt className="text-muted-foreground">建立日期</dt><dd className="text-right font-medium">{formatDate(shipment.createdAt)}</dd></div><div className="flex items-start justify-between gap-4 py-3"><dt className="text-muted-foreground">出貨時間</dt><dd className="text-right font-medium">{shipment.shippedAt ? formatDate(shipment.shippedAt) : '尚未出貨'}</dd></div><div className="flex items-start justify-between gap-4 py-3"><dt className="text-muted-foreground">運送方式</dt><dd className="text-right font-medium">{shipment.carrier ?? 'HQ 安排配送'}</dd></div><div className="flex items-start justify-between gap-4 py-3 pb-0"><dt className="text-muted-foreground">物流編號</dt><dd className="break-all text-right font-medium">{shipment.trackingNumber ?? '尚未提供'}</dd></div></dl>{shipment.notes ? <div className="mt-5 rounded-2xl bg-muted/60 px-3.5 py-3 text-sm text-muted-foreground"><span className="mb-1 block text-xs font-semibold text-foreground">備註</span>{shipment.notes}</div> : null}</section>
              <section className="rounded-[24px] border border-border/80 bg-card p-5 shadow-[0_18px_48px_rgba(22,50,37,0.07)]"><div className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-base font-semibold">收貨進度</h2></div><ol className="mt-5 space-y-5">{timeline.map((step, index) => <li key={step.label} className="relative flex gap-3">{index < timeline.length - 1 ? <span className={`absolute left-[11px] top-6 h-[calc(100%+4px)] w-px ${step.done ? 'bg-primary/45' : 'bg-border'}`} aria-hidden /> : null}<span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground'}`}>{step.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}</span><span className="min-w-0 pb-1"><span className={`block text-sm font-medium ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span><span className="mt-1 block text-xs text-muted-foreground">{step.done ? formatDate(step.date) : '等待處理'}</span></span></li>)}</ol>{canConfirmReceipt ? <div className="mt-5 flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />請核對所有品項後，再於左側確認入庫。</div> : null}</section>
            </aside>
          </div>
        </div>
      </main>
    </PosShell>
  );
}
