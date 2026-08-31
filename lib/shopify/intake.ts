import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { compareShopifySourceVersion } from '../orders/oms';
import { intakeSummary, preserveOperationalOrder, record, snapshotHash, sourceDate, string,
  type Snapshot, type ShopifyOrderTopic } from './intake-policy';

export type IntakeEvent = { shopDomain: string; topic: ShopifyOrderTopic; eventId: string; snapshot: Snapshot; origin?: 'reconcile' };

/** Short, bounded intake transaction. No product lookup, customer creation or external side effects. */
export async function persistShopifyIntake(db: PrismaClient, input: IntakeEvent) {
  const { snapshot, shopDomain, topic, eventId } = input;
  const externalOrderId = String(snapshot.order.id);
  const hash = snapshotHash(snapshot);
  const version = sourceDate(snapshot.order.updated_at);
  const eventKey = { shopDomain_topic_eventId: { shopDomain, topic, eventId } };
  const eventData = { shopDomain, topic, eventId, externalOrderId, sourceUpdatedAt: version,
    payload: snapshot as Prisma.InputJsonObject, payloadHash: hash,
    payloadExpiresAt: new Date(Date.now() + 30 * 86400000) };
  try {
    return await db.$transaction(async tx => {
      // Same shop/order must serialize even before its first row exists. Hash collision only serializes unrelated orders.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shopify:${shopDomain}:${externalOrderId}`}, 0))`;
      const priorEvent = await tx.shopifyWebhookEvent.findUnique({ where: eventKey });
      if (priorEvent && priorEvent.payloadHash !== hash) throw new Error('EVENT_ID_CONFLICT');
      if (priorEvent && ['PROCESSED', 'IGNORED'].includes(priorEvent.status)) {
        return { created: false, disposition: 'duplicate' };
      }
      const event = await tx.shopifyWebhookEvent.upsert({ where: eventKey,
        create: { ...eventData, attempts: 1 },
        update: { status: 'RECEIVED', lastErrorCode: null, attempts: { increment: 1 } } });
      const key = { externalStore_externalOrderId: { externalStore: shopDomain, externalOrderId } };
      const existing = await tx.order.findUnique({ where: key });
      const finish = async (status: 'PROCESSED' | 'IGNORED', reason: string | null = null) => {
        await tx.shopifyWebhookEvent.update({ where: { id: event.id },
          data: { status, processedAt: new Date(), lastErrorCode: reason, nextAttemptAt: null } });
      };
      const comparison = compareShopifySourceVersion(existing?.shopifySourceUpdatedAt ?? null, version);
      // Reconciliation is not authorization to enroll existing legacy workflows, especially shipped orders.
      if (input.origin === 'reconcile' && existing && !existing.omsStatus) {
        await finish('IGNORED', 'LEGACY_ORDER_NOT_ENROLLED');
        return { created: false, disposition: 'legacy' };
      }
      if (existing && comparison === 'older') {
        await finish('IGNORED', 'STALE_SOURCE_VERSION');
        return { created: false, disposition: 'stale' };
      }
      if (existing?.shopifySnapshot &&
        snapshotHash(existing.shopifySnapshot as Snapshot) === hash) {
        await finish('IGNORED');
        return { created: false, disposition: 'duplicate' };
      }
      // Equal or missing timestamps with different data cannot safely overwrite a known snapshot.
      if (existing?.shopifySnapshot && (comparison === 'same' || comparison === 'unknown')) {
        await tx.order.update({ where: { id: existing.id }, data: {
          omsIssueFlags: [{ code: 'SOURCE_VERSION_UNKNOWN', severity: 'blocking', message: '收到版本衝突的更新，需重新同步 Shopify' }],
          omsCheckedAt: null, omsCheckedSourceUpdatedAt: null,
          ...(preserveOperationalOrder(existing) ? {} : { omsStatus: 'NEW', omsReviewedAt: null, omsReviewedById: null }),
        } });
        await finish('IGNORED', 'SOURCE_VERSION_CONFLICT');
        return { created: false, disposition: 'conflict' };
      }
      const summary = intakeSummary(snapshot);
      const shipping = record(snapshot.order.shipping_address);
      const address = ['zip', 'province', 'city', 'address1', 'address2', 'company']
        .map(key => string(shipping[key])).filter(Boolean).join(' ') || null;
      const common = { shopifySnapshot: snapshot as Prisma.InputJsonObject,
        shopifySourceUpdatedAt: version, shopifyLastEventId: eventId,
        omsIssueFlags: summary.issues as Prisma.InputJsonValue,
        omsCheckedAt: null, omsCheckedSourceUpdatedAt: null,
        paymentStatus: summary.paymentStatus };
      const amounts = { subtotal: summary.subtotal, discount: summary.discount,
        shippingFee: summary.shippingFee, total: summary.total };
      if (!existing) {
        // Never manufacture a Product to satisfy OrderItem's FK. Every line lives in the snapshot first.
        const order = await tx.order.create({ data: { ...common, ...amounts,
          orderNumber: `SHOP-${createHash('sha256').update(shopDomain).digest('hex').slice(0, 12)}-${externalOrderId}`,
          source: 'shopify', externalStore: shopDomain, externalOrderId,
          externalOrderName: string(snapshot.order.name) || null,
          status: snapshot.order.cancelled_at ? 'cancelled' : 'pending_review', omsStatus: 'NEW',
          fulfillmentStatus: 'pending', shippingMethod: 'home', shippingAddress: address,
          note: 'Shopify 訂單已保存；明細與收件資料請查看來源快照，完成審核前不可出貨。',
          orderedAt: sourceDate(snapshot.order.created_at) ?? new Date(),
        } });
        await tx.statusAuditLog.create({ data: { entityType: 'order', entityId: order.id,
          newStatus: 'NEW', actorType: 'system', metadataJson: JSON.stringify({ topic, eventId }) } });
      } else {
        await tx.order.update({ where: { id: existing.id }, data: { ...common,
          ...(preserveOperationalOrder(existing) ? {} : { ...amounts, omsStatus: 'NEW',
            status: snapshot.order.cancelled_at ? 'cancelled' : 'pending_review',
            omsReviewedAt: null, omsReviewedById: null }),
        } });
      }
      await finish('PROCESSED');
      return { created: !existing, disposition: 'saved' };
    }, { maxWait: 500, timeout: 2500 });
  } catch (error) {
    // Best-effort metadata only. Never turn a failed order transaction into an HTTP success.
    // A complete DB outage is observable via the sanitized server log and Shopify retry response.
    const code = error instanceof Error && error.message === 'EVENT_ID_CONFLICT' ? 'EVENT_ID_CONFLICT' : 'INTAKE_FAILED';
    try {
      await db.shopifyWebhookEvent.upsert({ where: eventKey,
        create: { ...eventData, status: 'FAILED', attempts: 1, lastErrorCode: code },
        update: {} }); // Do not overwrite a concurrently committed successful event.
    } catch { /* Caller logs a fixed code without payloads or credentials. */ }
    throw new Error(code);
  }
}
