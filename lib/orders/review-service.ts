import type { Prisma, PrismaClient } from '@prisma/client';
import { record, snapshotHash, string, type Snapshot } from '../shopify/intake-policy';
import { checkReview, reviewDraft, type ReviewDraft } from './review-policy';
import { omsApprovalBlockers, parseOmsIssues } from './oms';

export class ReviewError extends Error {}
export type ReviewCommand = { orderId: string; actorId: string; sourceHash: string;
  action: 'check' | 'approve' | 'ship'; draft?: ReviewDraft };

/** Shared order lock with intake: review cannot race an incoming Shopify update. */
export async function runReview(db: PrismaClient, command: ReviewCommand) {
  return db.$transaction(async tx => {
    const actor = await tx.user.findUnique({ where: { id: command.actorId } });
    if (!actor || !['admin', 'staff'].includes(actor.role)) throw new ReviewError('需要有審核權限的 HQ 人員操作');
    const key = await tx.order.findUnique({ where: { id: command.orderId } });
    if (!key?.externalStore || !key.externalOrderId || !key.omsStatus) throw new ReviewError('此訂單不適用 Shopify OMS');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shopify:${key.externalStore}:${key.externalOrderId}`}, 0))`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: key.id }, include: { shipments: true } });
    const snapshot = order.shopifySnapshot as Snapshot | null;
    if (order.deletedAt) throw new ReviewError('訂單已從 HQ 刪除，請先還原後重新審核');
    if (!snapshot || snapshotHash(snapshot) !== command.sourceHash) throw new ReviewError('訂單已更新，請重新整理後再審核');
    if (command.action === 'ship' && order.omsStatus === 'FULFILLMENT_PENDING' && order.shipments.some(s => s.shipmentNumber === `OMS-${order.id}`)) {
      return { message: '出貨單已存在，沒有重複建立' };
    }
    if (!['NEW', 'REVIEW', 'READY'].includes(order.omsStatus ?? '') ||
      ['cancelled', 'packed', 'shipped', 'delivered', 'completed'].includes(order.status) || order.shipments.length) {
      throw new ReviewError('訂單已取消或已進入出貨流程，不能變更審核');
    }
    // Conflicting same-version payload must be reconciled at source, not cleared by a reviewer.
    if (parseOmsIssues(order.omsIssueFlags)?.some(i => i.code === 'SOURCE_VERSION_UNKNOWN')) throw new ReviewError('來源版本不明或衝突，需先重新同步 Shopify');
    const audit = await tx.statusAuditLog.findFirst({ where: { entityType: 'oms_review', entityId: order.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    let saved: Record<string, unknown> = {};
    try { saved = JSON.parse(audit?.metadataJson ?? '{}'); } catch { /* fail closed below */ }
    const draft = command.action === 'check' ? reviewDraft(command.draft) : reviewDraft(saved.draft);
    if (command.action !== 'check' && saved.sourceHash !== command.sourceHash) throw new ReviewError('請先儲存並檢查目前版本');
    if (command.action !== 'check' && JSON.stringify(reviewDraft(command.draft)) !== JSON.stringify(draft)) throw new ReviewError('表單內容已修改，請先儲存並檢查');
    if (command.action === 'ship') {
      if (order.omsStatus !== 'READY' || !order.omsReviewedAt || !order.omsReviewedById) throw new ReviewError('需要先由人員確認訂單');
      // Serializes new OMS reservations; legacy fulfillment still requires its own final stock check.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'oms:stock-allocation'}, 0))`;
    }
    const products = await tx.product.findMany({ where: { id: { in: draft.lines.map(l => l.productId).filter(Boolean) } }, include: { inventoryBalances: true, priceTiers: true } });
    const reservations = await tx.shipmentItem.groupBy({ by: ['productId'], where: {
      productId: { in: products.map(p => p.id) }, shipment: { status: { in: ['pending', 'packed'] }, OR: [{ orderId: null }, { orderId: { not: order.id } }] },
    }, _sum: { quantity: true } });
    const reserved = new Map(reservations.map(r => [r.productId, r._sum.quantity ?? 0]));
    const contact = string(snapshot.order.email) || string(snapshot.order.phone) || string(record(snapshot.order.shipping_address).phone);
    const duplicate = contact ? await tx.order.findFirst({ where: {
      id: { not: order.id }, externalStore: order.externalStore, total: order.total,
      orderedAt: { gte: new Date(order.orderedAt.getTime() - 86400000), lte: new Date(order.orderedAt.getTime() + 86400000) },
      OR: [ { shopifySnapshot: { path: ['order', 'email'], equals: contact } },
        { shopifySnapshot: { path: ['order', 'phone'], equals: contact } },
        { shopifySnapshot: { path: ['order', 'shipping_address', 'phone'], equals: contact } } ],
    }, select: { id: true } }) : null;
    const result = checkReview(snapshot, draft, products.map(p => ({ ...p,
      available: p.inventoryBalances.length ? p.inventoryBalances.reduce((n, b) => n + b.quantity, 0) - (reserved.get(p.id) ?? 0) : null,
    })), Boolean(duplicate));
    // Existing tier-based stock/weight handling needs an explicit variant selection, never guess it.
    if (products.some(p => p.priceTiers.length > 0)) result.issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '包含多規格商品；本版尚未支援規格對應，不能直接出貨' });
    if (products.some(p => p.productCategory !== 'STANDARD')) result.issues.push({ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '包含換罐、服務或其他特殊商品，需要專用履約流程，不能當一般商品出貨' });
    const now = new Date();
    if (command.action === 'check') {
      await tx.order.update({ where: { id: order.id }, data: { omsStatus: 'REVIEW',
        omsIssueFlags: result.issues as Prisma.InputJsonValue, omsCheckedAt: now,
        omsCheckedSourceUpdatedAt: order.shopifySourceUpdatedAt, omsReviewedAt: null, omsReviewedById: null } });
      await tx.statusAuditLog.create({ data: { entityType: 'oms_review', entityId: order.id,
        previousStatus: order.omsStatus, newStatus: 'REVIEW', actorType: 'user', actorId: actor.id,
        metadataJson: JSON.stringify({ schemaVersion: 1, sourceHash: command.sourceHash, draft }) } });
      return { message: result.issues.some(i => i.severity === 'blocking') ? '已儲存，請處理上方列出的問題後重新檢查' : '檢查通過，可以確認訂單' };
    }
    const blockers = omsApprovalBlockers({ omsStatus: command.action === 'ship' ? 'REVIEW' : order.omsStatus,
      issues: result.issues, checkedAt: order.omsCheckedAt, checkedSourceUpdatedAt: order.omsCheckedSourceUpdatedAt,
      sourceUpdatedAt: order.shopifySourceUpdatedAt, actorId: actor.id, actorCanReview: true, cancelled: Boolean(snapshot.order.cancelled_at) });
    if (blockers.length) throw new ReviewError(blockers.join('；'));
    if (command.action === 'approve') {
      await tx.order.update({ where: { id: order.id }, data: { omsStatus: 'READY', omsReviewedAt: now,
        omsReviewedById: actor.id, omsIssueFlags: result.issues as Prisma.InputJsonValue, omsCheckedAt: now } });
    } else {
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.orderItem.createMany({ data: result.items.map(item => ({ ...item, orderId: order.id })) });
      await tx.shipment.create({ data: { shipmentNumber: `OMS-${order.id}`, type: 'customer_order', status: 'pending', orderId: order.id,
        recipientName: draft.recipient, recipientPhone: draft.phone, recipientAddress: draft.address,
        carrier: draft.method === 'convenience' ? '7-11' : '黑貓',
        notes: `HQ 內部待出貨單，尚未傳送物流供應商。溫層：${draft.temperature}；門市：${draft.storeId} ${draft.storeName}`,
        items: { create: result.items.map(({ productId, productName, sku, quantity }) => ({ productId, productName, sku, quantity })) } } });
      await tx.order.update({ where: { id: order.id }, data: { omsStatus: 'FULFILLMENT_PENDING', status: 'confirmed',
        shippingMethod: draft.method, shippingAddress: draft.address, cvsBrand: draft.method === 'convenience' ? '7-11' : null,
        cvsStoreId: draft.storeId || null, cvsStoreName: draft.storeName || null } });
    }
    await tx.statusAuditLog.create({ data: { entityType: 'order', entityId: order.id, previousStatus: order.omsStatus,
      newStatus: command.action === 'approve' ? 'READY' : 'FULFILLMENT_PENDING', actorType: 'user', actorId: actor.id,
      metadataJson: JSON.stringify({ sourceHash: command.sourceHash, reviewAuditId: audit!.id }) } });
    return { message: command.action === 'approve' ? '已確認，可建立出貨單（尚未送物流）' : '已建立 HQ 內部出貨單；尚未連接物流供應商' };
  }, { maxWait: 2000, timeout: 10000 });
}
