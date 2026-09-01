import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ensureMooncakeProduct } from '@/lib/products/ensure-mooncake';
import type { MatchableProduct } from '@/lib/shopify/match-line-item';
import { ShopifyWebhookRetryableError } from '@/lib/shopify/webhook-errors';

export const SHOPIFY_CONFLICT_RETRY_ATTEMPTS = 3;

export type ShopifyOrderItemRecord = {
  id: string;
  sku: string;
  quantity: number;
  productId: string;
  productName: string;
  unitPrice: number;
  subtotal: number;
  weightGrams: number | null;
  unit: string | null;
};

export type ShopifyShipmentRecord = {
  id: string;
  type: string;
  status: string;
  packedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
};

export type ShopifyOrderRecord = {
  id: string;
  orderNumber: string;
  source: string;
  externalStore: string | null;
  externalOrderId: string | null;
  externalOrderName: string | null;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  shippingFeeType: string;
  customerId: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  companyShippingCost: number;
  total: number;
  shippingMethod: string;
  shippingAddress: string | null;
  cvsBrand: string | null;
  cvsStoreId: string | null;
  cvsStoreName: string | null;
  note: string | null;
  orderedAt: Date;
  items: ShopifyOrderItemRecord[];
  shipments: ShopifyShipmentRecord[];
};

export type ShopifyOrderCreateData = {
  orderNumber: string;
  source: string;
  externalStore: string;
  externalOrderId: string;
  externalOrderName: string | null;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  shippingFeeType: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  companyShippingCost: number;
  total: number;
  shippingMethod: string;
  shippingAddress: string | null;
  cvsBrand: string | null;
  cvsStoreId: string | null;
  cvsStoreName: string | null;
  note: string | null;
  orderedAt: Date;
  items: Array<Omit<ShopifyOrderItemRecord, 'id'>>;
};

export type ShopifyOrderUpdateData = {
  paymentStatus?: string;
  shippingFeeType?: string;
  subtotal?: number;
  discount?: number;
  shippingFee?: number;
  companyShippingCost?: number;
  total?: number;
  shippingMethod?: string;
  shippingAddress?: string | null;
  cvsBrand?: string | null;
  cvsStoreId?: string | null;
  cvsStoreName?: string | null;
  note?: string | null;
  replaceItems?: Array<Omit<ShopifyOrderItemRecord, 'id'>>;
};

export type ShopifyAuditCreateData = {
  entityType: string;
  entityId: string;
  previousStatus: string | null;
  newStatus: string;
  actorType: string;
  actorId: string | null;
  metadataJson: string;
};

export type ShopifyAuditRow = {
  id: string;
  actorId: string | null;
  metadataJson: string | null;
  createdAt: Date;
};

export type ShopifyWebhookTx = {
  order: {
    findByExternal: (externalStore: string, externalOrderId: string) => Promise<ShopifyOrderRecord | null>;
    create: (data: ShopifyOrderCreateData) => Promise<ShopifyOrderRecord>;
    update: (id: string, data: ShopifyOrderUpdateData) => Promise<ShopifyOrderRecord>;
  };
  product: {
    findMatchable: (skus: string[]) => Promise<MatchableProduct[]>;
  };
  shipment: {
    updateStatus: (
      id: string,
      data: {
        status: string;
        packedAt?: Date | null;
        shippedAt?: Date | null;
        deliveredAt?: Date | null;
        cancelledAt?: Date | null;
      },
    ) => Promise<ShopifyShipmentRecord>;
  };
  statusAuditLog: {
    listForEntity: (entityType: string, entityId: string) => Promise<ShopifyAuditRow[]>;
    create: (data: ShopifyAuditCreateData) => Promise<ShopifyAuditRow>;
  };
  ensureMooncake: () => Promise<MatchableProduct | null>;
};

export type ShopifyWebhookDb = {
  $transaction: <T>(fn: (tx: ShopifyWebhookTx) => Promise<T>) => Promise<T>;
};

export function isUniqueConflictError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if (!('code' in error)) return false;
  const code = error.code;
  return code === 'P2002' || code === 'P2034';
}

export async function withUniqueConflictRetry<T>(
  work: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
  attempts = SHOPIFY_CONFLICT_RETRY_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (!isUniqueConflictError(error) || attempt === attempts) {
        if (isUniqueConflictError(error)) {
          throw new ShopifyWebhookRetryableError('Shopify webhook 寫入衝突，請稍後重試');
        }
        throw error;
      }
      await sleep(50 * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ShopifyWebhookRetryableError('Shopify webhook 寫入衝突，請稍後重試');
}

function toMatchableProduct(product: {
  id: string;
  name: string;
  sku: string;
  sourceSku: string | null;
  unit: string;
  priceTiers: { weightGrams: number | null; price: number }[];
}): MatchableProduct {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    sourceSku: product.sourceSku,
    unit: product.unit,
    priceTiers: product.priceTiers,
  };
}

function toOrderRecord(order: {
  id: string;
  orderNumber: string;
  source: string;
  externalStore: string | null;
  externalOrderId: string | null;
  externalOrderName: string | null;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  shippingFeeType: string;
  customerId: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  companyShippingCost: number;
  total: number;
  shippingMethod: string;
  shippingAddress: string | null;
  cvsBrand: string | null;
  cvsStoreId: string | null;
  cvsStoreName: string | null;
  note: string | null;
  orderedAt: Date;
  items: ShopifyOrderItemRecord[];
  shipments: ShopifyShipmentRecord[];
}): ShopifyOrderRecord {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    source: order.source,
    externalStore: order.externalStore,
    externalOrderId: order.externalOrderId,
    externalOrderName: order.externalOrderName,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    shippingFeeType: order.shippingFeeType,
    customerId: order.customerId,
    subtotal: order.subtotal,
    discount: order.discount,
    shippingFee: order.shippingFee,
    companyShippingCost: order.companyShippingCost,
    total: order.total,
    shippingMethod: order.shippingMethod,
    shippingAddress: order.shippingAddress,
    cvsBrand: order.cvsBrand,
    cvsStoreId: order.cvsStoreId,
    cvsStoreName: order.cvsStoreName,
    note: order.note,
    orderedAt: order.orderedAt,
    items: order.items,
    shipments: order.shipments,
  };
}

function wrapPrismaTx(tx: Prisma.TransactionClient): ShopifyWebhookTx {
  const include = { items: true, shipments: true } as const;
  return {
    order: {
      findByExternal: async (externalStore, externalOrderId) => {
        const row = await tx.order.findUnique({
          where: { externalStore_externalOrderId: { externalStore, externalOrderId } },
          include,
        });
        return row ? toOrderRecord(row) : null;
      },
      create: async (data) => {
        const row = await tx.order.create({
          data: {
            orderNumber: data.orderNumber,
            source: data.source,
            externalStore: data.externalStore,
            externalOrderId: data.externalOrderId,
            externalOrderName: data.externalOrderName,
            status: data.status,
            paymentStatus: data.paymentStatus,
            fulfillmentStatus: data.fulfillmentStatus,
            shippingFeeType: data.shippingFeeType,
            subtotal: data.subtotal,
            discount: data.discount,
            shippingFee: data.shippingFee,
            companyShippingCost: data.companyShippingCost,
            total: data.total,
            shippingMethod: data.shippingMethod,
            shippingAddress: data.shippingAddress,
            cvsBrand: data.cvsBrand,
            cvsStoreId: data.cvsStoreId,
            cvsStoreName: data.cvsStoreName,
            note: data.note,
            orderedAt: data.orderedAt,
            items: {
              create: data.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                sku: item.sku,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                weightGrams: item.weightGrams,
                unit: item.unit,
              })),
            },
          },
          include,
        });
        return toOrderRecord(row);
      },
      update: async (id, data) => {
        const row = await tx.order.update({
          where: { id },
          data: {
            paymentStatus: data.paymentStatus,
            shippingFeeType: data.shippingFeeType,
            subtotal: data.subtotal,
            discount: data.discount,
            shippingFee: data.shippingFee,
            companyShippingCost: data.companyShippingCost,
            total: data.total,
            shippingMethod: data.shippingMethod,
            shippingAddress: data.shippingAddress,
            cvsBrand: data.cvsBrand,
            cvsStoreId: data.cvsStoreId,
            cvsStoreName: data.cvsStoreName,
            note: data.note,
            items: data.replaceItems
              ? {
                  deleteMany: {},
                  create: data.replaceItems.map((item) => ({
                    productId: item.productId,
                    productName: item.productName,
                    sku: item.sku,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.subtotal,
                    weightGrams: item.weightGrams,
                    unit: item.unit,
                  })),
                }
              : undefined,
          },
          include,
        });
        return toOrderRecord(row);
      },
    },
    product: {
      findMatchable: async (skus) => {
        const matched = await tx.product.findMany({
          where: skus.length
            ? { OR: [{ sku: { in: skus } }, { sourceSku: { in: skus } }] }
            : { status: 'active' },
          include: { priceTiers: { select: { weightGrams: true, price: true } } },
        });
        if (!skus.length) return matched.map(toMatchableProduct);
        const extras = await tx.product.findMany({
          where: { status: 'active' },
          include: { priceTiers: { select: { weightGrams: true, price: true } } },
        });
        const seen = new Set(matched.map((product) => product.id));
        return [...matched, ...extras.filter((product) => !seen.has(product.id))].map(toMatchableProduct);
      },
    },
    shipment: {
      updateStatus: async (id, data) => {
        const row = await tx.shipment.update({
          where: { id },
          data: {
            status: data.status,
            packedAt: data.packedAt,
            shippedAt: data.shippedAt,
            deliveredAt: data.deliveredAt,
            cancelledAt: data.cancelledAt,
          },
        });
        return {
          id: row.id,
          type: row.type,
          status: row.status,
          packedAt: row.packedAt,
          shippedAt: row.shippedAt,
          deliveredAt: row.deliveredAt,
          cancelledAt: row.cancelledAt,
        };
      },
    },
    statusAuditLog: {
      listForEntity: async (entityType, entityId) => {
        const rows = await tx.statusAuditLog.findMany({
          where: { entityType, entityId },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((row) => ({
          id: row.id,
          actorId: row.actorId,
          metadataJson: row.metadataJson,
          createdAt: row.createdAt,
        }));
      },
      create: async (data) => {
        const row = await tx.statusAuditLog.create({
          data: {
            entityType: data.entityType,
            entityId: data.entityId,
            previousStatus: data.previousStatus,
            newStatus: data.newStatus,
            actorType: data.actorType,
            actorId: data.actorId,
            metadataJson: data.metadataJson,
          },
        });
        return {
          id: row.id,
          actorId: row.actorId,
          metadataJson: row.metadataJson,
          createdAt: row.createdAt,
        };
      },
    },
    ensureMooncake: async () => {
      const product = await ensureMooncakeProduct(tx);
      return toMatchableProduct(product);
    },
  };
}

export function createPrismaShopifyStore(client: PrismaClient = prisma): ShopifyWebhookDb {
  return {
    $transaction: (fn) => client.$transaction((tx) => fn(wrapPrismaTx(tx))),
  };
}

export function defaultShopifySleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
