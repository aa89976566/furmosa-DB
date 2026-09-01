import type { MatchableProduct } from '@/lib/shopify/match-line-item';
import { parseShopifyAuditMetadata, shopifyAuditEntityId } from '@/lib/shopify/event-version';
import type {
  ShopifyAuditRow,
  ShopifyOrderCreateData,
  ShopifyOrderRecord,
  ShopifyOrderUpdateData,
  ShopifyShipmentRecord,
  ShopifyWebhookDb,
  ShopifyWebhookTx,
} from '@/lib/shopify/webhook-store';

function cloneOrder(order: ShopifyOrderRecord): ShopifyOrderRecord {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
    shipments: order.shipments.map((shipment) => ({ ...shipment })),
  };
}

export class FakeShopifyStore implements ShopifyWebhookDb {
  orders = new Map<string, ShopifyOrderRecord>();
  audits: ShopifyAuditRow[] = [];
  products: MatchableProduct[] = [];
  createConflictsRemaining = 0;
  createAttempts = 0;
  customerWrites = 0;
  inventoryWrites = 0;
  settlementWrites = 0;
  shipmentCreates = 0;
  private nextId = 1;
  private txQueue: Promise<void> = Promise.resolve();

  key(externalStore: string, externalOrderId: string) {
    return `${externalStore}::${externalOrderId}`;
  }

  private id(prefix: string) {
    const value = this.nextId;
    this.nextId += 1;
    return `${prefix}_${value}`;
  }

  seedProduct(product: MatchableProduct) {
    this.products.push(product);
  }

  seedOrder(order: ShopifyOrderRecord) {
    if (!order.externalStore || !order.externalOrderId) {
      throw new Error('seeded order needs external identifiers');
    }
    this.orders.set(this.key(order.externalStore, order.externalOrderId), cloneOrder(order));
  }

  getOrder(externalStore: string, externalOrderId: string) {
    const row = this.orders.get(this.key(externalStore, externalOrderId));
    return row ? cloneOrder(row) : null;
  }

  private throwConflict() {
    const error = new Error('Unique constraint failed');
    Object.assign(error, { code: 'P2002' });
    throw error;
  }

  private tx(): ShopifyWebhookTx {
    return {
      order: {
        findByExternal: async (externalStore, externalOrderId) => {
          const row = this.orders.get(this.key(externalStore, externalOrderId));
          return row ? cloneOrder(row) : null;
        },
        create: async (data: ShopifyOrderCreateData) => {
          this.createAttempts += 1;
          if (this.createConflictsRemaining > 0) {
            this.createConflictsRemaining -= 1;
            this.throwConflict();
          }
          const mapKey = this.key(data.externalStore, data.externalOrderId);
          if (this.orders.has(mapKey)) this.throwConflict();
          const created: ShopifyOrderRecord = {
            ...data,
            id: this.id('ord'),
            customerId: null,
            items: data.items.map((item) => ({ ...item, id: this.id('item') })),
            shipments: [],
          };
          this.orders.set(mapKey, created);
          return cloneOrder(created);
        },
        update: async (id: string, data: ShopifyOrderUpdateData) => {
          const entry = [...this.orders.entries()].find(([, order]) => order.id === id);
          if (!entry) throw new Error('order not found');
          const current = entry[1];
          if (data.replaceItems) {
            current.items = data.replaceItems.map((item) => ({ ...item, id: this.id('item') }));
          }
          if (data.paymentStatus !== undefined) current.paymentStatus = data.paymentStatus;
          if (data.shippingFeeType !== undefined) current.shippingFeeType = data.shippingFeeType;
          if (data.subtotal !== undefined) current.subtotal = data.subtotal;
          if (data.discount !== undefined) current.discount = data.discount;
          if (data.shippingFee !== undefined) current.shippingFee = data.shippingFee;
          if (data.companyShippingCost !== undefined) current.companyShippingCost = data.companyShippingCost;
          if (data.total !== undefined) current.total = data.total;
          if (data.shippingMethod !== undefined) current.shippingMethod = data.shippingMethod;
          if (data.shippingAddress !== undefined) current.shippingAddress = data.shippingAddress;
          if (data.cvsBrand !== undefined) current.cvsBrand = data.cvsBrand;
          if (data.cvsStoreId !== undefined) current.cvsStoreId = data.cvsStoreId;
          if (data.cvsStoreName !== undefined) current.cvsStoreName = data.cvsStoreName;
          if (data.note !== undefined) current.note = data.note;
          return cloneOrder(current);
        },
      },
      product: {
        findMatchable: async (skus) => {
          if (!skus.length) return [...this.products];
          const exact = this.products.filter(
            (product) => skus.includes(product.sku) || (product.sourceSku != null && skus.includes(product.sourceSku)),
          );
          const seen = new Set(exact.map((product) => product.id));
          return [...exact, ...this.products.filter((product) => !seen.has(product.id))];
        },
      },
      shipment: {
        updateStatus: async (id, data) => {
          for (const order of this.orders.values()) {
            const shipment = order.shipments.find((row) => row.id === id);
            if (!shipment) continue;
            shipment.status = data.status;
            if (data.packedAt !== undefined) shipment.packedAt = data.packedAt;
            if (data.shippedAt !== undefined) shipment.shippedAt = data.shippedAt;
            if (data.deliveredAt !== undefined) shipment.deliveredAt = data.deliveredAt;
            if (data.cancelledAt !== undefined) shipment.cancelledAt = data.cancelledAt;
            return { ...shipment };
          }
          throw new Error('shipment not found');
        },
      },
      statusAuditLog: {
        listForEntity: async (entityType, entityId) => {
          return this.audits
            .filter((row) => {
              if (entityType !== 'shopify_order') return false;
              const meta = parseShopifyAuditMetadata(row.metadataJson);
              if (!meta) return false;
              return shopifyAuditEntityId(meta.shopDomain, meta.externalOrderId) === entityId;
            })
            .map((row) => ({ ...row }));
        },
        create: async (data) => {
          const row: ShopifyAuditRow = {
            id: this.id('aud'),
            actorId: data.actorId,
            metadataJson: data.metadataJson,
            createdAt: new Date(),
          };
          this.audits.push(row);
          return { ...row };
        },
      },
      ensureMooncake: async () => null,
    };
  }

  async $transaction<T>(fn: (tx: ShopifyWebhookTx) => Promise<T>): Promise<T> {
    const run = this.txQueue.then(async () => {
      const snapshot = {
        orders: new Map([...this.orders.entries()].map(([key, order]) => [key, cloneOrder(order)])),
        audits: this.audits.map((row) => ({ ...row })),
        nextId: this.nextId,
      };
      try {
        return await fn(this.tx());
      } catch (error) {
        this.orders = snapshot.orders;
        this.audits = snapshot.audits;
        this.nextId = snapshot.nextId;
        throw error;
      }
    });
    this.txQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export function sampleShipment(status: ShopifyShipmentRecord['status'], id = 'shp_1'): ShopifyShipmentRecord {
  return {
    id,
    type: 'customer_order',
    status,
    packedAt: status === 'packed' || status === 'shipped' || status === 'delivered' ? new Date('2026-09-01T01:00:00Z') : null,
    shippedAt: status === 'shipped' || status === 'delivered' ? new Date('2026-09-01T02:00:00Z') : null,
    deliveredAt: status === 'delivered' ? new Date('2026-09-01T03:00:00Z') : null,
    cancelledAt: status === 'cancelled' ? new Date('2026-09-01T04:00:00Z') : null,
  };
}
