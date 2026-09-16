import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { snapshotHash, string, type Snapshot } from '@/lib/shopify/intake-policy';
import { currentReviewDraft } from '@/lib/orders/review-display';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { OmsReviewForm } from './oms-review-form';
import { shopifySourceDraft, shopifyShippingLabel } from '@/lib/orders/shopify-source-review';

function paymentSummary(source: Snapshot) {
  const financialStatus = string(source.order.financial_status);
  const map: Record<string, { label: string; tone: 'ready' | 'hold' | 'danger' }> = {
    paid: { label: '已付款', tone: 'ready' },
    pending: { label: '未付款', tone: 'hold' },
    authorized: { label: '待請款', tone: 'hold' },
    partially_paid: { label: '部分付款', tone: 'hold' },
    refunded: { label: '已退款', tone: 'danger' },
    partially_refunded: { label: '部分退款', tone: 'danger' },
    voided: { label: '已作廢', tone: 'danger' },
  };
  return { financialStatus, ...(map[financialStatus] ?? { label: '付款待確認', tone: 'hold' as const }) };
}

export async function OmsReviewPanel({ orderId, snapshot, status }: { orderId: string; snapshot: unknown; status: string | null }) {
  const sourceView = snapshotView(snapshot);
  if (!status || !['NEW', 'REVIEW', 'READY'].includes(status) || !sourceView) return null;
  const session = await getCurrentUser();
  const actor = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } }) : null;
  if (!actor || !['admin', 'staff'].includes(actor.role)) return <p>需要 HQ 審核人員確認此訂單。</p>;
  const source = snapshot as Snapshot;
  const hash = snapshotHash(source);

  const audit = await prisma.statusAuditLog.findFirst({ where: { entityType: 'oms_review', entityId: orderId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const saved = currentReviewDraft(snapshot, audit?.metadataJson);
  const draft = shopifySourceDraft(source, [], saved?.duplicateConfirmed ?? false);
  const payment = paymentSummary(source);
  const shippingLabel = shopifyShippingLabel(source);

  return <section id="oms-review" tabIndex={-1} className="space-y-4 rounded-xl border bg-card p-4 md:p-5" aria-label="OMS 訂單審核">
    <div className="border-b pb-4">
      <h2 className="text-lg font-semibold">處理訂單</h2>
      <p className="mt-1 text-sm text-muted-foreground">先核對 Shopify 原始內容；HQ 只處理系統無法判定的例外。</p>
      {status === 'READY' ? <div className="mt-3 rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
        <p className="font-semibold text-success">訂單已確認</p>
        <p className="mt-1 text-muted-foreground">商品與配送內容維持以 Shopify 訂單為準。</p>
      </div> : null}
    </div>
    <OmsReviewForm key={hash} orderId={orderId} sourceHash={hash} status={status}
      draft={draft}
      sourceSummary={{
        paymentLabel: payment.label,
        paymentTone: payment.tone,
        total: sourceView.total,
        currency: sourceView.currency,
        recipient: sourceView.recipient,
        phone: sourceView.phone,
        address: sourceView.address,
        shippingLabel,
        items: sourceView.items.map(item => ({ title: item.title, quantity: item.quantity === null ? '數量待確認' : `×${item.quantity}`, sku: item.sku })),
      }} />
  </section>;
}
