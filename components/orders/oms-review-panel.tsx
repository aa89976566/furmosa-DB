import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { record, snapshotHash, string, type Snapshot } from '@/lib/shopify/intake-policy';
import { currentReviewDraft } from '@/lib/orders/review-display';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { isMooncakeShopifyItem } from '@/lib/shopify/match-line-item';
import { ensureMooncakeProduct } from '@/lib/products/ensure-mooncake';
import { OmsReviewForm } from './oms-review-form';
import { defaultReviewDraft, fillReviewDraftBlanks, reviewLineDisplays } from '@/lib/orders/review-defaults';
import { buildFulfillmentPlan } from '@/lib/orders/fulfillment-plan';
import { PROMOTION_GIFT_SKU } from '@/lib/orders/promotion-resolver';

const productSelect = {
  id: true, name: true, sku: true, sourceSku: true, defaultTemperature: true, status: true,
  cost: true, unit: true, productCategory: true,
  priceTiers: { select: { id: true, weightGrams: true, unit: true, unitQty: true, cost: true } },
} as const;

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

function sourceHasMooncake(source: Snapshot) {
  const rows = Array.isArray(source.order.line_items) ? source.order.line_items.map(record) : [];
  return rows.some(row => isMooncakeShopifyItem({
    title: string(row.title), variant_title: string(row.variant_title), sku: string(row.sku),
  }));
}

export async function OmsReviewPanel({ orderId, snapshot, status }: { orderId: string; snapshot: unknown; status: string | null }) {
  const sourceView = snapshotView(snapshot);
  if (!status || !['NEW', 'REVIEW', 'READY'].includes(status) || !sourceView) return null;
  const session = await getCurrentUser();
  const actor = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } }) : null;
  if (!actor || !['admin', 'staff'].includes(actor.role)) return <p>需要 HQ 審核人員確認此訂單。</p>;
  const source = snapshot as Snapshot;
  const hash = snapshotHash(source);

  // 既有 OMS intake 不查商品主檔；月餅是已知活動商品，進審核時先以唯一主檔規則補齊 CK-08、active 與 frozen。
  if (sourceHasMooncake(source)) await ensureMooncakeProduct(prisma);

  const [catalog, giftCandidates, audit] = await Promise.all([
    prisma.product.findMany({ where: { status: 'active' }, select: productSelect, orderBy: { sku: 'asc' } }),
    prisma.product.findMany({ where: { OR: [{ sku: PROMOTION_GIFT_SKU }, { sourceSku: PROMOTION_GIFT_SKU }] }, select: productSelect }),
    prisma.statusAuditLog.findFirst({ where: { entityType: 'oms_review', entityId: orderId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
  ]);
  const productsById = new Map(catalog.map(product => [product.id, product]));
  for (const product of giftCandidates) if (!productsById.has(product.id)) productsById.set(product.id, product);
  const planProducts = [...productsById.values()];
  const suggested = defaultReviewDraft(source, catalog);
  const saved = currentReviewDraft(snapshot, audit?.metadataJson);
  const upgraded = saved ? fillReviewDraftBlanks(saved, suggested) : { draft: suggested, applied: false };
  const draft = {
    ...upgraded.draft,
    recipient: upgraded.draft.recipient.trim() || sourceView.recipient,
    phone: upgraded.draft.phone.trim() || sourceView.phone,
    address: upgraded.draft.address.trim() || sourceView.address,
  };
  const contactApplied = Boolean(saved && (
    (!saved.recipient.trim() && draft.recipient)
    || (!saved.phone.trim() && draft.phone)
    || (!saved.address.trim() && draft.address)
  ));
  const plan = buildFulfillmentPlan(source, draft, planProducts.map(product => ({ ...product, available: null })));
  const payment = paymentSummary(source);
  const shipping = Array.isArray(source.order.shipping_lines) ? source.order.shipping_lines.map(record) : [];
  const shippingLabel = shipping.map(row => string(row.title) || string(row.code)).filter(Boolean).join('、');

  return <section id="oms-review" tabIndex={-1} className="space-y-4 rounded-xl border bg-card p-4 md:p-5" aria-label="OMS 訂單審核">
    <div className="border-b pb-4">
      <h2 className="text-lg font-semibold">處理訂單</h2>
      <p className="mt-1 text-sm text-muted-foreground">先核對 Shopify 原始內容；HQ 只處理系統無法判定的例外。</p>
      {status === 'READY' ? <div className="mt-3 rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
        <p className="font-semibold text-success">訂單已確認</p>
        <p className="mt-1 text-muted-foreground">下一步：建立 HQ 出貨單，再進入運送資訊流程。</p>
        <a href="#oms-shipping" className="mt-2 inline-block font-medium text-info underline">查看運送資訊</a>
      </div> : null}
      {(upgraded.applied || contactApplied) && <p className="mt-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning">系統已補入 Shopify／商品主檔資料；請確認標示為「待完成」的例外。</p>}
    </div>
    <OmsReviewForm key={hash} orderId={orderId} sourceHash={hash} status={status}
      draft={draft} products={catalog} lineDisplays={reviewLineDisplays(source, catalog, draft, saved)}
      promotionSummary={plan.display}
      sourceSummary={{
        paymentLabel: payment.label,
        paymentTone: payment.tone,
        financialStatus: payment.financialStatus,
        total: sourceView.total,
        currency: sourceView.currency,
        recipient: sourceView.recipient,
        phone: sourceView.phone,
        address: sourceView.address,
        shippingLabel,
      }} />
  </section>;
}
