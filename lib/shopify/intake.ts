import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { compareShopifySourceVersion } from '../orders/oms';
import { classifyShopifyLines, type TierCatalogProduct, type TierReviewIssue } from './match-product-tier';
import { intakeSummary, preserveOperationalOrder, record, snapshotHash, sourceDate, string,
  hasPromotionCapture, stripPromotionCapture,
  type Snapshot, type ShopifyOrderTopic } from './intake-policy';

export type IntakeEvent = { shopDomain: string; topic: ShopifyOrderTopic; eventId: string; snapshot: Snapshot; origin?: 'reconcile' };

async function readTierCatalog(tx: Prisma.TransactionClient): Promise<TierCatalogProduct[]> {
  const product = (tx as Prisma.TransactionClient & {
    product?: { findMany?: (args: unknown) => Promise<TierCatalogProduct[]> };
  }).product;
  if (!product?.findMany) return [];
  return product.findMany({
    where: { status: 'active' },
    select: {
      id: true, sku: true, sourceSku: true, name: true, unit: true,
      priceTiers: {
        select: {
          id: true, productId: true, sku: true, shopifyVariantId: true, shopifySku: true, status: true,
          weightGrams: true, unit: true, unitQty: true, price: true,
          defaultWholesaleUnitPrice: true, defaultConsignmentCommissionMode: true,
          defaultConsignmentCommissionValue: true,
        },
      },
    },
  });
}

function resolvedOrderItems(snapshot: Snapshot, catalog: TierCatalogProduct[]) {
  const lines = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
  const classified = classifyShopifyLines(lines.map((row) => ({ variant_id: row.variant_id, sku: string(row.sku) })), catalog);
  if (classified.status === 'review') return { items: null, issues: classified.issues };
  const items = classified.matches.map((decision, index) => {
    const row = lines[index] ?? {};
    const product = catalog.find((entry) => entry.id === decision.productId);
    const quantity = row.quantity;
    const price = row.price;
    if (!product || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) return null;
    if (typeof price !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(price)) return null;
    const unitPrice = Number(price);
    return {
      productId: product.id,
      productName: string(row.title) || product.name,
      sku: string(row.sku) || decision.tier.sku || product.sku,
      quantity,
      unitPrice,
      subtotal: unitPrice * quantity,
      weightGrams: decision.tier.weightGrams,
      unit: decision.tier.unit,
      variantKey: decision.tier.id || null,
    };
  });
  if (items.some((item) => !item)) {
    const issues: TierReviewIssue[] = [{ code: 'PRODUCT_UNMAPPED', severity: 'blocking', message: '商品數量或金額無法安全建檔，需人工審核' }];
    return { items: null, issues };
  }
  return { items: items.filter((item): item is NonNullable<typeof item> => Boolean(item)), issues: [] as TierReviewIssue[] };
}

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
      // Same-timestamp reconcile may add W2 capture fields only when the rest of the snapshot is identical.
      if (input.origin === 'reconcile' && existing && !existing.deletedAt && existing.omsStatus
        && !preserveOperationalOrder(existing) && comparison === 'same' && existing.shopifySnapshot
        && !hasPromotionCapture(existing.shopifySnapshot)
        && hasPromotionCapture(snapshot)
        && snapshotHash(stripPromotionCapture(snapshot)) === snapshotHash(existing.shopifySnapshot as Snapshot)) {
        const summary = intakeSummary(snapshot);
        const shipping = record(snapshot.order.shipping_address);
        const address = ['zip', 'province', 'city', 'address1', 'address2', 'company']
          .map(key => string(shipping[key])).filter(Boolean).join(' ') || null;
        await tx.order.update({ where: { id: existing.id }, data: {
          shopifySnapshot: snapshot as Prisma.InputJsonObject,
          shopifySourceUpdatedAt: version, shopifyLastEventId: eventId,
          omsIssueFlags: summary.issues as Prisma.InputJsonValue,
          omsCheckedAt: null, omsCheckedSourceUpdatedAt: null,
          paymentStatus: summary.paymentStatus,
          subtotal: summary.subtotal, discount: summary.discount,
          shippingFee: summary.shippingFee, total: summary.total,
          shippingAddress: address,
          omsStatus: 'NEW', omsReviewedAt: null, omsReviewedById: null,
          status: snapshot.order.cancelled_at ? 'cancelled' : 'pending_review',
        } });
        await finish('PROCESSED');
        return { created: false, disposition: 'saved' };
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
      const resolved = resolvedOrderItems(snapshot, await readTierCatalog(tx));
      for (const issue of resolved.issues) {
        if (!summary.issues.some((existing) => existing.code === issue.code && existing.message === issue.message)) {
          summary.issues.push(issue);
        }
      }
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
          ...(resolved.items ? { items: { create: resolved.items } } : {}),
        } });
        await tx.statusAuditLog.create({ data: { entityType: 'order', entityId: order.id,
          newStatus: 'NEW', actorType: 'system', metadataJson: JSON.stringify({ topic, eventId }) } });
      } else {
        // Soft deletion is HQ-owned: never clear deletedAt/deletedById/deletionReason on source updates.
        await tx.order.update({ where: { id: existing.id }, data: { ...common,
          ...(preserveOperationalOrder(existing) ? {} : { ...amounts, omsStatus: 'NEW',
            status: snapshot.order.cancelled_at ? 'cancelled' : 'pending_review',
            omsReviewedAt: null, omsReviewedById: null }),
        } });
        const itemsApi = (tx as Prisma.TransactionClient & {
          orderItem?: {
            count?: (args: unknown) => Promise<number>;
            createMany?: (args: unknown) => Promise<unknown>;
          };
        }).orderItem;
        if (resolved.items && !preserveOperationalOrder(existing) && itemsApi?.count && itemsApi.createMany) {
          const count = await itemsApi.count({ where: { orderId: existing.id } });
          if (count === 0) {
            await itemsApi.createMany({ data: resolved.items.map((item) => ({ ...item, orderId: existing.id })) });
          }
        }
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
