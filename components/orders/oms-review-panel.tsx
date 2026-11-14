import { adjustedSnapshot } from '@/lib/orders/hq-adjustment';
import { HqAdjustmentForm } from './hq-adjustment-form';
import { OrderDeletionForm } from './order-deletion-form';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { record, snapshotHash, string, type Snapshot } from '@/lib/shopify/intake-policy';
import { toTierCatalog } from '@/lib/shopify/match-line-item';
import { matchShopifyLineToTier } from '@/lib/shopify/match-product-tier';
import { currentReviewDraft } from '@/lib/orders/review-display';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { OmsReviewForm } from './oms-review-form';
import { mergeShopifyFulfillmentDraft, shopifySourceDraft, shopifyShippingLabel } from '@/lib/orders/shopify-source-review';

function shopifyOrderUrl(store: string | null | undefined, id: unknown) {
  const match = store?.match(/^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/i);
  const orderId = typeof id === 'string' ? id : String(id ?? '');
  return match && /^[1-9]\d*$/.test(orderId) ? `https://admin.shopify.com/store/${match[1]}/orders/${orderId}` : null;
}

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

export async function OmsReviewPanel({ orderId, snapshot, status, externalStore, needsReviewRecovery = false }: { orderId: string; snapshot: unknown; status: string | null; externalStore?: string | null; needsReviewRecovery?: boolean }) {
  const adjustment = await prisma.statusAuditLog.findFirst({ where: { entityType: 'hq_order_adjustment', entityId: orderId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const originalSnapshot = snapshot;
  let adjustmentError = '';
  try { if (snapshotView(snapshot)) snapshot = adjustedSnapshot(snapshot as Snapshot, adjustment); }
  catch (error) { adjustmentError = error instanceof Error ? error.message : 'HQ 調整資料無效'; }
  const sourceView = snapshotView(snapshot);
  if (!status || (!['NEW', 'REVIEW', 'READY'].includes(status) && !(needsReviewRecovery && status === 'FULFILLMENT_PENDING')) || !sourceView) return null;
  const session = await getCurrentUser();
  const actor = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } }) : null;
  if (!actor || !['admin', 'staff'].includes(actor.role)) return <p>需要 HQ 審核人員確認此訂單。</p>;
  const source = snapshot as Snapshot;
  const hash = snapshotHash(source);

  const audit = await prisma.statusAuditLog.findFirst({ where: { entityType: 'oms_review', entityId: orderId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const saved = currentReviewDraft(snapshot, audit?.metadataJson);
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    select: {
      id: true, name: true, sku: true, sourceSku: true, status: true, unit: true, defaultTemperature: true,
      priceTiers: { where: { status: 'active' }, select: { id: true, variantName: true, weightGrams: true, unit: true, unitQty: true, price: true, sku: true, shopifySku: true, shopifyVariantId: true, status: true, notes: true } },
    },
  });
  const sourceDraft = shopifySourceDraft(source, products.map(product => ({ ...product, available: null })), saved?.duplicateConfirmed ?? false);
  const draft = saved
    ? mergeShopifyFulfillmentDraft(sourceDraft, saved)
    : mergeShopifyFulfillmentDraft(sourceDraft, sourceDraft);
  const payment = paymentSummary(source);
  const shippingLabel = shopifyShippingLabel(source);
  const activeShipment = await prisma.shipment.count({ where: { orderId, status: { not: 'cancelled' } } });
  const sourceRows = Array.isArray(source.order.line_items) ? source.order.line_items.map(record) : [];

  return <section id="oms-review" tabIndex={-1} className="space-y-4 rounded-xl border bg-card p-4 md:p-5" aria-label="OMS 訂單審核">
    <div className="border-b pb-4">
      <h2 className="text-lg font-semibold">{needsReviewRecovery ? '重新核對既有出貨單' : '處理訂單'}</h2>
      {needsReviewRecovery ? <p role="alert" className="mt-2 text-sm text-amber-700">這張待出貨單缺少審核紀錄。請重新檢查內容，再確認既有出貨單；不會建立另一張出貨單。</p> : null}
      <p className="mt-1 text-sm text-muted-foreground">核對 HQ 實際訂單；人工修改只影響 HQ，Shopify 原單保留供比對。</p>
      {status === 'READY' ? <div className="mt-3 rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
        <p className="font-semibold text-success">訂單已確認</p>
        <p className="mt-1 text-muted-foreground">商品與配送內容已依 HQ 最新審核確認。下一步：建立 HQ 出貨單。</p>
      </div> : null}
    </div>
    {['NEW', 'REVIEW', 'READY'].includes(status) && !activeShipment ? <HqAdjustmentForm key={`${hash}-${adjustment?.id ?? ''}`} orderNumber={sourceView.name} orderId={orderId} source={originalSnapshot as Snapshot} sourceHash={snapshotHash(originalSnapshot as Snapshot)} revision={adjustment?.id ?? ''} metadata={adjustment?.metadataJson ?? null} options={products.flatMap(product => product.priceTiers.map(tier => ({ id: tier.id, label: `${product.name}｜${tier.variantName?.trim() || `${tier.weightGrams ?? ''}${tier.unit}`}`, price: String(tier.price), sku: tier.shopifySku || tier.sku || product.sku || '' })))} /> : null}
    {actor.role === 'admin' ? <OrderDeletionForm orderId={orderId} orderNumber={sourceView.name} deleted={false} /> : null}
    {adjustmentError ? <p role="alert" className="rounded-lg border p-3 text-destructive">{adjustmentError}</p> : <OmsReviewForm key={hash} orderId={orderId} sourceHash={hash} status={needsReviewRecovery ? 'NEW' : status} pendingShipmentReview={needsReviewRecovery}
      draft={draft}
      sourceSummary={{
        paymentLabel: payment.label,
        adminUrl: shopifyOrderUrl(externalStore, source.order.id),
        subtotal: sourceView.subtotal,
        shippingFee: sourceView.shippingFee,
        paymentTone: payment.tone,
        total: sourceView.total,
        currency: sourceView.currency,
        recipient: sourceView.recipient,
        phone: sourceView.phone,
        address: sourceView.address,
        shippingLabel,
        items: sourceView.items.map((item, index) => {
          const row = sourceRows[index] ?? {};
          const decision = matchShopifyLineToTier(
            { variant_id: row.variant_id, sku: string(row.sku) || item.sku, title: string(row.title) || item.title },
            toTierCatalog(products),
          );
          return {
            title: item.title,
            quantity: item.quantity === null ? '數量待確認' : `×${item.quantity}`,
            sku: item.sku,
            contents: decision.outcome === 'match' ? decision.tier.notes?.trim() || '' : '',
          };
        }),
      }} /> }

  </section>;
}
