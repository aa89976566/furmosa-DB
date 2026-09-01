import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { record, snapshotHash, string, type Snapshot } from '@/lib/shopify/intake-policy';
import { currentReviewDraft } from '@/lib/orders/review-display';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { OmsReviewForm } from './oms-review-form';
import { defaultReviewDraft, fillReviewDraftBlanks } from '@/lib/orders/review-defaults';

export async function OmsReviewPanel({ orderId, snapshot, status }: { orderId: string; snapshot: unknown; status: string | null }) {
  const sourceView = snapshotView(snapshot);
  if (!status || !['NEW', 'REVIEW', 'READY'].includes(status) || !sourceView) return null;
  const session = await getCurrentUser();
  const actor = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } }) : null;
  if (!actor || !['admin', 'staff'].includes(actor.role)) return <p>需要 HQ 審核人員確認此訂單。</p>;
  const source = snapshot as Snapshot;
  const hash = snapshotHash(source);
  const [products, audit] = await Promise.all([
    prisma.product.findMany({ where: { status: 'active' }, select: { id: true, name: true, sku: true, sourceSku: true, defaultTemperature: true }, orderBy: { sku: 'asc' } }),
    prisma.statusAuditLog.findFirst({ where: { entityType: 'oms_review', entityId: orderId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
  ]);
  const rows = Array.isArray(source.order.line_items) ? source.order.line_items.map(record) : [];
  const suggested = defaultReviewDraft(source, products);
  const saved = currentReviewDraft(snapshot, audit?.metadataJson);
  const upgraded = saved ? fillReviewDraftBlanks(saved, suggested) : { draft: suggested, applied: false };
  // Contact data is operationally critical. Read it from the same safe source projection
  // used by the Shopify summary when an older saved review left a field blank.
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
  return <section className="space-y-3 rounded-xl border p-4 md:p-5" aria-label="OMS 訂單審核">
    <div>
      <p className="text-xs font-medium text-muted-foreground">主要工作區</p>
      <h2 className="mt-1 text-lg font-semibold">核對並確認訂單</h2>
      <p className="mt-1 text-sm text-muted-foreground">只需補齊上方標示的問題。儲存檢查通過後，才能確認訂單。</p>
      {(upgraded.applied || contactApplied) && <p className="mt-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning">系統已在空白欄位補入 Shopify／商品主檔建議；尚未儲存，請核對後按「儲存並檢查」。</p>}
    </div>
    <OmsReviewForm key={`${hash}-${audit?.id ?? 'new'}`} orderId={orderId} sourceHash={hash} status={status}
      draft={draft} products={products} titles={rows.map(r => string(r.title) || '未命名商品')} />
  </section>;
}
