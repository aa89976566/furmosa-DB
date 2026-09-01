import {
  auditHasWebhookId,
  compactShopifyAuditMetadata,
  decideShopifyEventVersion,
  parseSourceUpdatedAt,
  shopifyAuditEntityId,
  stringifyShopifyAuditMetadata,
  type ShopifyAuditDecision,
  type ShopifyAuditMetadata,
  type ShopifyFieldGroup,
} from '@/lib/shopify/event-version';
import type { ShopifyFulfillmentPayload, ShopifyRefundPayload } from '@/lib/shopify/order-mapping';
import { ShopifyWebhookClientError } from '@/lib/shopify/webhook-errors';
import type { ShopifyWebhookTopic } from '@/lib/shopify/webhook-verify';
import {
  createPrismaShopifyStore,
  defaultShopifySleep,
  withUniqueConflictRetry,
  type ShopifyOrderRecord,
  type ShopifyShipmentRecord,
  type ShopifyWebhookDb,
  type ShopifyWebhookTx,
} from '@/lib/shopify/webhook-store';
import type { ShopifySyncResult } from '@/lib/shopify/order-sync';

const FULFILLMENT_RANK = {
  pending: 0,
  packed: 1,
  shipped: 2,
  delivered: 3,
} as const;

type FulfillmentStatus = keyof typeof FULFILLMENT_RANK;

function isFulfillmentStatus(value: string): value is FulfillmentStatus {
  return value in FULFILLMENT_RANK;
}

export function mapShopifyFulfillmentStatus(fulfillment: ShopifyFulfillmentPayload): FulfillmentStatus | null {
  const status = fulfillment.status?.trim().toLowerCase() ?? '';
  const shipmentStatus = fulfillment.shipment_status?.trim().toLowerCase() ?? '';
  if (status === 'error' || status === 'failure' || status === 'cancelled') return null;
  if (shipmentStatus === 'failure') return null;
  if (shipmentStatus === 'delivered') return 'delivered';
  if (
    shipmentStatus === 'in_transit' ||
    shipmentStatus === 'out_for_delivery' ||
    shipmentStatus === 'attempted_delivery'
  ) {
    return 'shipped';
  }
  if (
    shipmentStatus === 'confirmed' ||
    shipmentStatus === 'ready_for_pickup' ||
    shipmentStatus === 'label_printed' ||
    shipmentStatus === 'label_purchased'
  ) {
    return 'packed';
  }
  if (status === 'success') return 'shipped';
  if (status === 'pending' || status === 'open') return 'pending';
  return null;
}

const LIVE_SHIPMENT_RANK: Record<string, number> = {
  pending: 0,
  packed: 1,
  shipped: 2,
  delivered: 3,
};

function isLiveCustomerShipmentStatus(status: string) {
  return status === 'pending' || status === 'packed' || status === 'shipped' || status === 'delivered';
}

/** Prefer the furthest-along live customer_order shipment. Never pick cancelled when a live row exists. */
export function selectLinkedCustomerShipment(
  order: ShopifyOrderRecord | null,
): ShopifyShipmentRecord | null {
  if (!order) return null;
  const rows = order.shipments.filter((shipment) => shipment.type === 'customer_order');
  if (rows.length === 0) return null;
  const live = rows.filter((shipment) => isLiveCustomerShipmentStatus(shipment.status));
  const pool = live.length > 0 ? live : rows.filter((shipment) => shipment.status === 'cancelled');
  const ranked = (pool.length > 0 ? pool : rows).slice().sort((left, right) => {
    const rankLeft = LIVE_SHIPMENT_RANK[left.status] ?? -1;
    const rankRight = LIVE_SHIPMENT_RANK[right.status] ?? -1;
    if (rankLeft !== rankRight) return rankRight - rankLeft;
    if (left.id < right.id) return -1;
    if (left.id > right.id) return 1;
    return 0;
  });
  return ranked[0] ?? null;
}

async function writeAudit(
  tx: ShopifyWebhookTx,
  meta: ShopifyAuditMetadata,
  previousStatus: string | null,
  newStatus: string,
) {
  await tx.statusAuditLog.create({
    entityType: 'shopify_order',
    entityId: shopifyAuditEntityId(meta.shopDomain, meta.externalOrderId),
    previousStatus,
    newStatus,
    actorType: 'system',
    actorId: meta.webhookId || null,
    metadataJson: stringifyShopifyAuditMetadata(compactShopifyAuditMetadata(meta)),
  });
}

async function ignoreEvent(
  tx: ShopifyWebhookTx,
  input: {
    shopDomain: string;
    externalOrderId: string;
    webhookId: string;
    sourceUpdatedAt: string | null;
    topic: string;
    fieldGroup: ShopifyFieldGroup;
    decision: Exclude<ShopifyAuditDecision, 'accepted'>;
    order: ShopifyOrderRecord | null;
    previousStatus: string | null;
  },
): Promise<ShopifySyncResult> {
  await writeAudit(
    tx,
    {
      topic: input.topic,
      shopDomain: input.shopDomain,
      externalOrderId: input.externalOrderId,
      webhookId: input.webhookId,
      sourceUpdatedAt: input.sourceUpdatedAt,
      fieldGroup: input.fieldGroup,
      decision: input.decision,
    },
    input.previousStatus,
    input.previousStatus ?? input.decision,
  );
  return {
    ignored: true,
    created: false,
    updated: false,
    decision: input.decision,
    order: input.order,
  };
}

export async function syncShopifyCancellation(input: {
  topic: Extract<ShopifyWebhookTopic, 'orders/cancelled'>;
  shopDomain: string;
  webhookId: string;
  orderId: string;
  sourceUpdatedAt: string | null;
  db?: ShopifyWebhookDb;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ShopifySyncResult> {
  const externalStore = input.shopDomain.trim().toLowerCase();
  if (!externalStore) throw new ShopifyWebhookClientError('缺少 Shopify shop domain', 403);
  const db = input.db ?? createPrismaShopifyStore();
  const sleep = input.sleep ?? defaultShopifySleep;

  return withUniqueConflictRetry(async () => {
    return db.$transaction(async (tx) => {
      const entityId = shopifyAuditEntityId(externalStore, input.orderId);
      const audits = await tx.statusAuditLog.listForEntity('shopify_order', entityId);
      if (auditHasWebhookId(audits, input.webhookId)) {
        const existing = await tx.order.findByExternal(externalStore, input.orderId);
        return {
          ignored: true,
          created: false,
          updated: false,
          decision: 'ignored_duplicate' as const,
          order: existing,
        };
      }

      const version = decideShopifyEventVersion({
        records: audits,
        fieldGroup: 'cancellation',
        webhookId: input.webhookId,
        sourceUpdatedAt: input.sourceUpdatedAt,
      });
      const existing = await tx.order.findByExternal(externalStore, input.orderId);
      const shipment = selectLinkedCustomerShipment(existing);
      const previous = shipment?.status ?? existing?.status ?? null;

      if (version.action !== 'apply') {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: input.orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt: input.sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'cancellation',
          decision: version.decision,
          order: existing,
          previousStatus: previous,
        });
      }

      if (!existing) {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: input.orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt: input.sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'cancellation',
          decision: 'ignored_missing_order',
          order: null,
          previousStatus: null,
        });
      }

      if (!shipment) {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: input.orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt: input.sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'cancellation',
          decision: 'ignored_missing_shipment',
          order: existing,
          previousStatus: existing.status,
        });
      }

      if (shipment.status === 'shipped' || shipment.status === 'delivered') {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: input.orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt: input.sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'cancellation',
          decision: 'ignored_not_cancellable',
          order: existing,
          previousStatus: shipment.status,
        });
      }

      if (shipment.status === 'cancelled') {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: input.orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt: input.sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'cancellation',
          decision: 'ignored_terminal',
          order: existing,
          previousStatus: shipment.status,
        });
      }

      if (shipment.status !== 'pending' && shipment.status !== 'packed') {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: input.orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt: input.sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'cancellation',
          decision: 'ignored_not_cancellable',
          order: existing,
          previousStatus: shipment.status,
        });
      }

      const cancelledAt = input.sourceUpdatedAt ? new Date(input.sourceUpdatedAt) : new Date();
      await tx.shipment.updateStatus(shipment.id, { status: 'cancelled', cancelledAt });
      const updated = await tx.order.findByExternal(externalStore, input.orderId);
      await writeAudit(
        tx,
        {
          topic: input.topic,
          shopDomain: externalStore,
          externalOrderId: input.orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt: input.sourceUpdatedAt,
          fieldGroup: 'cancellation',
          decision: 'accepted',
        },
        shipment.status,
        'cancelled',
      );
      return {
        ignored: false,
        created: false,
        updated: true,
        decision: 'accepted' as const,
        order: updated,
      };
    });
  }, sleep);
}

export async function syncShopifyFulfillment(input: {
  topic: Extract<ShopifyWebhookTopic, 'fulfillments/create' | 'fulfillments/update'>;
  shopDomain: string;
  webhookId: string;
  fulfillment: ShopifyFulfillmentPayload;
  db?: ShopifyWebhookDb;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ShopifySyncResult> {
  const externalStore = input.shopDomain.trim().toLowerCase();
  if (!externalStore) throw new ShopifyWebhookClientError('缺少 Shopify shop domain', 403);
  const orderId = String(input.fulfillment.order_id);
  const sourceUpdatedAt = parseSourceUpdatedAt(input.fulfillment.updated_at ?? input.fulfillment.created_at);
  const db = input.db ?? createPrismaShopifyStore();
  const sleep = input.sleep ?? defaultShopifySleep;

  return withUniqueConflictRetry(async () => {
    return db.$transaction(async (tx) => {
      const entityId = shopifyAuditEntityId(externalStore, orderId);
      const audits = await tx.statusAuditLog.listForEntity('shopify_order', entityId);
      if (auditHasWebhookId(audits, input.webhookId)) {
        const existing = await tx.order.findByExternal(externalStore, orderId);
        return {
          ignored: true,
          created: false,
          updated: false,
          decision: 'ignored_duplicate' as const,
          order: existing,
        };
      }

      const version = decideShopifyEventVersion({
        records: audits,
        fieldGroup: 'fulfillment',
        webhookId: input.webhookId,
        sourceUpdatedAt,
      });
      const existing = await tx.order.findByExternal(externalStore, orderId);
      const shipment = selectLinkedCustomerShipment(existing);
      const previous = shipment?.status ?? existing?.status ?? null;

      if (version.action !== 'apply') {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'fulfillment',
          decision: version.decision,
          order: existing,
          previousStatus: previous,
        });
      }

      if (!shipment) {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'fulfillment',
          decision: existing ? 'ignored_missing_shipment' : 'ignored_missing_order',
          order: existing,
          previousStatus: previous,
        });
      }

      if (shipment.status === 'cancelled') {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'fulfillment',
          decision: 'ignored_terminal',
          order: existing,
          previousStatus: shipment.status,
        });
      }

      const nextStatus = mapShopifyFulfillmentStatus(input.fulfillment);
      if (!nextStatus) {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'fulfillment',
          decision: 'ignored_unknown_status',
          order: existing,
          previousStatus: shipment.status,
        });
      }

      const current = isFulfillmentStatus(shipment.status) ? shipment.status : 'pending';
      if (FULFILLMENT_RANK[nextStatus] < FULFILLMENT_RANK[current]) {
        return ignoreEvent(tx, {
          shopDomain: externalStore,
          externalOrderId: orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt,
          topic: input.topic,
          fieldGroup: 'fulfillment',
          decision: 'ignored_stale',
          order: existing,
          previousStatus: shipment.status,
        });
      }

      if (nextStatus === current) {
        await writeAudit(
          tx,
          {
            topic: input.topic,
            shopDomain: externalStore,
            externalOrderId: orderId,
            webhookId: input.webhookId,
            sourceUpdatedAt,
            fieldGroup: 'fulfillment',
            decision: 'accepted',
          },
          shipment.status,
          shipment.status,
        );
        return {
          ignored: true,
          created: false,
          updated: false,
          decision: 'accepted' as const,
          order: existing,
        };
      }

      const at = sourceUpdatedAt ? new Date(sourceUpdatedAt) : new Date();
      await tx.shipment.updateStatus(shipment.id, {
        status: nextStatus,
        packedAt: nextStatus === 'packed' || FULFILLMENT_RANK[nextStatus] > FULFILLMENT_RANK.packed ? at : undefined,
        shippedAt: nextStatus === 'shipped' || nextStatus === 'delivered' ? at : undefined,
        deliveredAt: nextStatus === 'delivered' ? at : undefined,
      });
      const updated = await tx.order.findByExternal(externalStore, orderId);
      await writeAudit(
        tx,
        {
          topic: input.topic,
          shopDomain: externalStore,
          externalOrderId: orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt,
          fieldGroup: 'fulfillment',
          decision: 'accepted',
        },
        shipment.status,
        nextStatus,
      );
      return {
        ignored: false,
        created: false,
        updated: true,
        decision: 'accepted' as const,
        order: updated,
      };
    });
  }, sleep);
}

export async function syncShopifyRefund(input: {
  topic: Extract<ShopifyWebhookTopic, 'refunds/create'>;
  shopDomain: string;
  webhookId: string;
  refund: ShopifyRefundPayload;
  db?: ShopifyWebhookDb;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ShopifySyncResult> {
  const externalStore = input.shopDomain.trim().toLowerCase();
  if (!externalStore) throw new ShopifyWebhookClientError('缺少 Shopify shop domain', 403);
  const orderId = String(input.refund.order_id);
  const sourceUpdatedAt = parseSourceUpdatedAt(input.refund.processed_at ?? input.refund.created_at);
  const db = input.db ?? createPrismaShopifyStore();
  const sleep = input.sleep ?? defaultShopifySleep;

  return withUniqueConflictRetry(async () => {
    return db.$transaction(async (tx) => {
      const entityId = shopifyAuditEntityId(externalStore, orderId);
      const audits = await tx.statusAuditLog.listForEntity('shopify_order', entityId);
      if (auditHasWebhookId(audits, input.webhookId)) {
        const existing = await tx.order.findByExternal(externalStore, orderId);
        return {
          ignored: true,
          created: false,
          updated: false,
          decision: 'ignored_duplicate' as const,
          order: existing,
        };
      }

      const existing = await tx.order.findByExternal(externalStore, orderId);
      const version = decideShopifyEventVersion({
        records: audits,
        fieldGroup: 'refund',
        webhookId: input.webhookId,
        sourceUpdatedAt,
      });
      const decision = version.action === 'apply' ? 'accepted' : version.decision;
      await writeAudit(
        tx,
        {
          topic: input.topic,
          shopDomain: externalStore,
          externalOrderId: orderId,
          webhookId: input.webhookId,
          sourceUpdatedAt,
          fieldGroup: 'refund',
          decision,
        },
        existing?.paymentStatus ?? null,
        existing?.paymentStatus ?? decision,
      );
      return {
        ignored: true,
        created: false,
        updated: false,
        decision,
        order: existing,
      };
    });
  }, sleep);
}
