import type { PrismaClient } from '@prisma/client';
import { snapshotHash, type Snapshot } from '../shopify/intake-policy';
import { adjustedSnapshot, adjustmentTotals, parseAdjustment, sourceRows, type AdjustmentLine } from './hq-adjustment';

export async function saveHqAdjustment(db: PrismaClient, input: { actorId: string; orderId: string; sourceHash: string; revision: string; reason: string; lines: AdjustmentLine[]; shippingFee: string }) {
  if (!input.reason.trim() || input.reason.trim().length > 500) throw new Error('請填寫修改原因，最多 500 字');
  if (!Array.isArray(input.lines) || input.lines.length > 100) throw new Error('最多可調整 100 項商品');
  return db.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: input.actorId }, select: { role: true } });
    if (!actor || !['admin', 'staff'].includes(actor.role)) throw new Error('需要 HQ 訂單管理權限');
    const key = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
    if (!key.externalStore || !key.externalOrderId || !key.omsStatus) throw new Error('此訂單不適用 HQ 調整');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shopify:${key.externalStore}:${key.externalOrderId}`}, 0))`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: key.id }, include: { shipments: true } });
    if (order.deletedAt || order.archivedAt || order.status === 'cancelled' || !['NEW', 'REVIEW', 'READY'].includes(order.omsStatus ?? '') || order.shipments.some(s => s.status !== 'cancelled')) throw new Error('只能修改尚未建立出貨單的待審核訂單');
    const source = order.shopifySnapshot as Snapshot;
    if (!source || snapshotHash(source) !== input.sourceHash) throw new Error('來源訂單已更新，請重新載入');
    const latest = await tx.statusAuditLog.findFirst({ where: { entityType: 'hq_order_adjustment', entityId: order.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    if ((latest?.id ?? '') !== input.revision) throw new Error('其他人已修改訂單，請重新載入後核對');
    const previous = parseAdjustment(latest?.metadataJson);
    const originalRows = previous?.lines ?? sourceRows(source);
    const seen = new Set<number>();
    const lines: Record<string, unknown>[] = [];
    for (const row of input.lines) {
      if (row.sourceIndex !== undefined) {
        if (!Number.isInteger(row.sourceIndex) || row.sourceIndex < 0 || !originalRows[row.sourceIndex] || seen.has(row.sourceIndex)) throw new Error('商品列已變更，請重新載入');
        seen.add(row.sourceIndex);
        const original = originalRows[row.sourceIndex]!;
        lines.push({ ...original, quantity: row.quantity, price: row.price,
          total_discount: original.quantity === row.quantity && original.price === row.price ? original.total_discount ?? '0' : '0' });
      } else {
        if (!row.tierId) throw new Error('請選擇新增商品規格');
        const tier = await tx.productPriceTier.findUnique({ where: { id: row.tierId }, include: { product: true } });
        if (!tier || tier.status !== 'active' || tier.product.status !== 'active') throw new Error('新增商品規格已停用');
        if (!tier.shopifyVariantId && !tier.shopifySku && !tier.sku && !tier.product.sku) throw new Error('此商品尚無可辨識規格');
        lines.push({ title: tier.product.name, variant_title: tier.variantName?.trim() || `${tier.weightGrams ?? ''}${tier.unit}`, quantity: row.quantity, price: row.price,
          sku: tier.shopifySku || tier.sku || tier.product.sku, variant_id: tier.shopifyVariantId || undefined,
          requires_shipping: true, total_discount: '0' });
      }
    }
    const totals = adjustmentTotals(lines, input.shippingFee);
    const after = { lines, ...totals, ...(previous?.financialStatus ? { financialStatus: previous.financialStatus } : {}) };
    const before = previous ? { lines: previous.lines, shippingFee: previous.shippingFee, subtotal: previous.subtotal, total: previous.total } : {
      lines: sourceRows(source), shippingFee: String((source.order.total_shipping_price_set as { shop_money?: { amount?: string } })?.shop_money?.amount ?? ''), subtotal: source.order.subtotal_price, total: source.order.total_price,
    };
    await tx.statusAuditLog.create({ data: { entityType: 'hq_order_adjustment', entityId: order.id, actorType: 'user', actorId: input.actorId,
      previousStatus: order.omsStatus, newStatus: 'REVIEW', metadataJson: JSON.stringify({ version: 1, sourceHash: input.sourceHash, reason: input.reason.trim(), before, after }) } });
    await tx.order.update({ where: { id: order.id }, data: { omsStatus: 'REVIEW', omsReviewedAt: null, omsReviewedById: null, omsCheckedAt: null, omsCheckedSourceUpdatedAt: null,
      omsIssueFlags: [{ code: 'ORDER_CHANGED', severity: 'blocking', message: 'HQ 已人工調整，請重新儲存並檢查後送審' }] } });
    return 'HQ 訂單已修改並留下操作紀錄，請重新檢查後確認訂單';
  });
}

/** HQ-only manual payment confirmation; preserves the source and every existing adjustment. */
export async function saveReviewPayment(db: PrismaClient, input: { actorId: string; orderId: string; sourceHash: string; payment: 'paid' | 'pending' }) {
  if (!['paid', 'pending'].includes(input.payment)) throw new Error('請選擇已付清或未付款');
  return db.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: input.actorId }, select: { role: true } });
    if (!actor || !['admin', 'staff'].includes(actor.role)) throw new Error('需要 HQ 訂單管理權限');
    const key = await tx.order.findUniqueOrThrow({ where: { id: input.orderId } });
    if (!key.externalStore || !key.externalOrderId || !key.omsStatus) throw new Error('此訂單不適用 HQ 調整');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shopify:${key.externalStore}:${key.externalOrderId}`}, 0))`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: key.id }, include: { shipments: true } });
    if (order.deletedAt || order.archivedAt || order.status === 'cancelled' || !['NEW', 'REVIEW', 'READY'].includes(order.omsStatus ?? '') || order.shipments.some(s => s.status !== 'cancelled')) throw new Error('只能修改尚未建立出貨單的待審核訂單');
    const source = order.shopifySnapshot as Snapshot;
    const latest = await tx.statusAuditLog.findFirst({ where: { entityType: 'hq_order_adjustment', entityId: order.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const effective = adjustedSnapshot(source, latest);
    if (snapshotHash(effective) !== input.sourceHash) throw new Error('訂單已更新，請重新整理後確認付款');
    const previous = parseAdjustment(latest?.metadataJson);
    const before = previous ?? { lines: sourceRows(source),
      shippingFee: String((source.order.total_shipping_price_set as { shop_money?: { amount?: string } })?.shop_money?.amount ?? '0'),
      subtotal: String(source.order.subtotal_price ?? ''), total: String(source.order.total_price ?? '') };
    const after = { ...before, totalDiscounts: previous?.totalDiscounts ?? (previous ? '0.00' : String(source.order.total_discounts ?? '0.00')), financialStatus: input.payment };
    const paymentAudit = await tx.statusAuditLog.create({ data: { entityType: 'hq_order_adjustment', entityId: order.id, actorType: 'user', actorId: input.actorId,
      previousStatus: order.omsStatus, newStatus: 'REVIEW', metadataJson: JSON.stringify({ version: 1, action: 'payment_confirmation', sourceHash: snapshotHash(source),
        reason: input.payment === 'paid' ? 'HQ 人工確認已付清' : 'HQ 人工確認未付款', before: { ...before, financialStatus: effective.order.financial_status }, after }) } });
    // Preserve same-version HQ delivery corrections; payment changes still invalidate approval/checks.
    const review = await tx.statusAuditLog.findFirst({ where: { entityType: 'oms_review', entityId: order.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    let saved: Record<string, unknown> = {};
    try { saved = JSON.parse(review?.metadataJson ?? '{}'); } catch { /* No valid saved delivery override. */ }
    if (saved.sourceHash === input.sourceHash && saved.draft) {
      await tx.statusAuditLog.create({ data: { entityType: 'oms_review', entityId: order.id, actorType: 'user', actorId: input.actorId,
        previousStatus: order.omsStatus, newStatus: 'REVIEW', metadataJson: JSON.stringify({ ...saved,
          sourceHash: snapshotHash(adjustedSnapshot(source, paymentAudit)), action: 'payment_confirmation_requires_recheck' }) } });
    }
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: input.payment === 'paid' ? 'paid' : 'unpaid', status: 'pending_review',
      omsStatus: 'REVIEW', omsReviewedAt: null, omsReviewedById: null, omsCheckedAt: null, omsCheckedSourceUpdatedAt: null,
      omsIssueFlags: [{ code: 'ORDER_CHANGED', severity: 'blocking', message: 'HQ 付款狀態已調整，請重新通過審核' }] } });
  });
}
