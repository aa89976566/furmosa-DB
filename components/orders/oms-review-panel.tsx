import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { record, snapshotHash, string, type Snapshot } from '@/lib/shopify/intake-policy';
import { reviewDraft } from '@/lib/orders/review-policy';
import { currentReviewDraft } from '@/lib/orders/review-display';
import { snapshotView } from '@/lib/shopify/snapshot-view';
import { OmsReviewForm } from './oms-review-form';

export async function OmsReviewPanel({ orderId, snapshot, status }: { orderId: string; snapshot: unknown; status: string | null }) {
  if (!status || !['NEW', 'REVIEW', 'READY'].includes(status) || !snapshotView(snapshot)) return null;
  const session = await getCurrentUser();
  const actor = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } }) : null;
  if (!actor || !['admin', 'staff'].includes(actor.role)) return <p>需要 HQ 審核人員確認此訂單。</p>;
  const source = snapshot as Snapshot;
  const hash = snapshotHash(source);
  const [products, audit] = await Promise.all([
    prisma.product.findMany({ where: { status: 'active' }, select: { id: true, name: true, sku: true, sourceSku: true }, orderBy: { sku: 'asc' } }),
    prisma.statusAuditLog.findFirst({ where: { entityType: 'oms_review', entityId: orderId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
  ]);
  const view = snapshotView(snapshot)!;
  const rows = Array.isArray(source.order.line_items) ? source.order.line_items.map(record) : [];
  const draft = currentReviewDraft(snapshot, audit?.metadataJson) ?? reviewDraft({
    lines: rows.map(row => {
      const sku = string(row.sku);
      const matches = sku ? products.filter(p => p.sku === sku || p.sourceSku === sku) : [];
      return { productId: matches.length === 1 ? matches[0].id : '', temperature: '' };
    }), recipient: view.recipient, phone: view.phone, address: view.address,
  });
  return <section className="space-y-3 rounded-xl border p-4 md:p-5" aria-label="OMS 訂單審核">
    <div>
      <p className="text-xs font-medium text-muted-foreground">主要工作區</p>
      <h2 className="mt-1 text-lg font-semibold">核對並確認訂單</h2>
      <p className="mt-1 text-sm text-muted-foreground">只需補齊上方標示的問題。儲存檢查通過後，才能確認訂單。</p>
    </div>
    <OmsReviewForm key={`${hash}-${audit?.id ?? 'new'}`} orderId={orderId} sourceHash={hash} status={status}
      draft={draft} products={products} titles={rows.map(r => string(r.title) || '未命名商品')} />
  </section>;
}
