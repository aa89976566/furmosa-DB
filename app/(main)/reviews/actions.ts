'use server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { bustCacheTags } from '@/lib/runtime-cache';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { emptyReviewResult, ReviewError, runReview } from '@/lib/orders/review-service';
import { adjustedSnapshot } from '@/lib/orders/hq-adjustment';
import { snapshotHash, type Snapshot } from '@/lib/shopify/intake-policy';
import { snapshotView } from '@/lib/shopify/snapshot-view';

async function reviewer() {
  const session = await getCurrentUser();
  const actor = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } }) : null;
  if (!actor || !['admin', 'staff', 'inventory_reviewer'].includes(actor.role)) throw new ReviewError('需要有審核權限的 HQ 人員操作');
  return actor;
}

export async function reviewInboxDecision(input: { orderId: string; sourceHash: string; reviewRevision: string; action: 'approve' | 'reject'; reason?: string }) {
  try {
    const actor = await reviewer();
    if (input.action !== 'approve' && input.action !== 'reject') throw new ReviewError('不支援的審核操作');
    const result = await runReview(prisma, { ...input, reviewRevision: String(input.reviewRevision ?? ''), actorId: actor.id, sourceOnly: true, quickApprove: input.action === 'approve' });
    // Cache failures after commit must not turn a successful decision into an apparent failure.
    try {
      for (const path of ['/reviews', '/orders', `/orders/${input.orderId}`, '/dashboard']) revalidatePath(path);
      void bustCacheTags(CACHE_TAGS.dashboard, CACHE_TAGS.orderHubTotals).catch(() => {});
    } catch { /* Committed decision is authoritative. */ }
    return result;
  } catch (error) {
    return emptyReviewResult({ ok: false, kind: error instanceof ReviewError ? error.kind : 'error',
      message: error instanceof ReviewError ? error.message : '審核未完成，請重新整理後再試',
      blockers: error instanceof ReviewError ? error.blockers : [] });
  }
}

export async function loadReviewOrderEditor(orderId: string, expectedHash: string) {
  const actor = await reviewer();
  if (!['admin', 'staff'].includes(actor.role)) throw new ReviewError('需要 HQ 訂單修改權限');
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipments: { where: { status: { not: 'cancelled' } } } } });
  if (!order || order.deletedAt || order.archivedAt || !['NEW', 'REVIEW', 'READY'].includes(order.omsStatus ?? '') || order.shipments.length) throw new ReviewError('此訂單目前無法修改，請重新整理確認狀態');
  const adjustment = await prisma.statusAuditLog.findFirst({ where: { entityType: 'hq_order_adjustment', entityId: orderId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const source = order.shopifySnapshot as Snapshot;
  const effective = adjustedSnapshot(source, adjustment);
  if (snapshotHash(effective) !== expectedHash) throw new ReviewError('訂單已更新，請重新整理後再修改');
  const products = await prisma.product.findMany({ where: { status: 'active' }, select: {
    id: true, name: true, sku: true, priceTiers: { where: { status: 'active' }, select: {
      id: true, variantName: true, weightGrams: true, unit: true, price: true, sku: true, shopifySku: true, shopifyVariantId: true,
    } },
  } });
  return { orderId, orderNumber: snapshotView(effective)?.name || order.orderNumber, source,
    sourceHash: snapshotHash(source), revision: adjustment?.id ?? '', metadata: adjustment?.metadataJson ?? null,
    options: products.flatMap(product => product.priceTiers.map(tier => ({ id: tier.id, productId: product.id,
      variantId: tier.shopifyVariantId, variantName: tier.variantName, label: `${product.name}｜${tier.variantName?.trim() || `${tier.weightGrams ?? ''}${tier.unit}`}`,
      price: String(tier.price), sku: tier.shopifySku || tier.sku || product.sku || '' }))) };
}
