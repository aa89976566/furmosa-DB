import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createRestockOrderWithShipment } from '@/lib/merchant-restock-order';
import {
  type ApprovedSnapshotLine,
  type RestockRequestType,
} from '@/lib/restock-request/constants';
import {
  RestockRequestConflictError,
  RestockRequestReviewError,
  assertApproveHasPositiveQty,
  assertHqReviewTransition,
  buildHqItemApprovals,
  hqReviewClaimCountIsConflict,
  hqReviewClaimWhere,
  parseHqRejectNote,
  shouldApplyHqItemPayload,
  type HqApprovedLine,
  type HqApprovedQtyPayload,
} from '@/lib/restock-request/review-policy';
import { isRestockableProductCategory } from '@/lib/product-category';
import { suggestedRestockQty } from '@/lib/pos/stock-status';
import {
  buildMerchantRestockInStoreIds,
  isMerchantRestockCatalogEligible,
  merchantRestockSubmitEligibility,
} from '@/lib/restock-request/catalog-eligibility';

type Db = Prisma.TransactionClient | typeof prisma;

export type MerchantRestockCatalogDb = Pick<
  typeof prisma,
  'product' | 'merchantStock' | 'merchantProductRule'
>;

export type SubmitSelfSelectDb = MerchantRestockCatalogDb &
  Pick<typeof prisma, 'restockRequest'>;

export type SubmitSelfSelectInput = {
  merchantId: string;
  merchantUserId: string;
  merchantNote?: string | null;
  items: { productId: string; quantity: number }[];
};

export type SubmitAutoReplenishInput = {
  merchantId: string;
  merchantUserId: string;
  merchantNote: string;
};

export async function listJarExchangeProductsForRestock() {
  return prisma.product.findMany({
    where: {
      status: 'active',
      productCategory: 'JAR_EXCHANGE',
    },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
    },
    orderBy: { name: 'asc' },
  });
}

export type MerchantRestockProduct = {
  id: string;
  name: string;
  unit: string;
  productCategory: string;
  stockQty: number;
  suggestedQty: number;
};

export async function listMerchantRestockCatalog(
  merchantId: string,
  db: MerchantRestockCatalogDb = prisma,
): Promise<MerchantRestockProduct[]> {
  const [catalogProducts, stocks, rules] = await Promise.all([
    db.product.findMany({
      where: {
        status: 'active',
        productCategory: { in: ['JAR_EXCHANGE', 'STANDARD'] },
      },
      select: {
        id: true,
        name: true,
        unit: true,
        productCategory: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    }),
    db.merchantStock.findMany({
      where: { merchantId },
      select: { productId: true, quantity: true },
    }),
    db.merchantProductRule.findMany({
      where: { merchantId },
      select: { productId: true },
    }),
  ]);

  const qtyByProduct = new Map<string, number>();
  for (const s of stocks) {
    qtyByProduct.set(s.productId, (qtyByProduct.get(s.productId) ?? 0) + s.quantity);
  }
  const inStore = buildMerchantRestockInStoreIds(stocks, rules);

  return catalogProducts
    .filter((p) => isMerchantRestockCatalogEligible(p, inStore))
    .map((p) => {
      const stockQty = qtyByProduct.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        productCategory: p.productCategory,
        stockQty,
        suggestedQty: suggestedRestockQty(stockQty),
      };
    });
}

async function assertMerchantRestockCatalogProducts(
  merchantId: string,
  productIds: string[],
  db: MerchantRestockCatalogDb,
) {
  const uniqueIds = [...new Set(productIds)];
  const [products, stocks, rules] = await Promise.all([
    db.product.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, status: true, productCategory: true },
    }),
    db.merchantStock.findMany({
      where: { merchantId, productId: { in: uniqueIds } },
      select: { productId: true },
    }),
    db.merchantProductRule.findMany({
      where: { merchantId, productId: { in: uniqueIds } },
      select: { productId: true },
    }),
  ]);
  const inStore = buildMerchantRestockInStoreIds(stocks, rules);
  const result = merchantRestockSubmitEligibility(uniqueIds, products, inStore);
  if (result.ok) return;
  if (result.reason === 'missing') {
    throw new RestockRequestReviewError('有商品不存在');
  }
  throw new RestockRequestReviewError('這項商品目前不能補貨');
}

export async function assertJarExchangeProducts(
  productIds: string[],
  db: Pick<typeof prisma, 'product'> = prisma,
) {
  if (productIds.length === 0) return;
  const rows = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, productCategory: true, name: true },
  });
  if (rows.length !== productIds.length) {
    throw new RestockRequestReviewError('有商品不存在');
  }
  const bad = rows.filter((r) => !isRestockableProductCategory(r.productCategory));
  if (bad.length > 0) {
    throw new RestockRequestReviewError('這項商品目前不能補貨');
  }
}

export async function submitSelfSelectRestockRequest(
  input: SubmitSelfSelectInput,
  db: SubmitSelfSelectDb = prisma,
) {
  const cleaned = input.items
    .map((it) => ({
      productId: it.productId,
      quantity: Math.floor(Number(it.quantity)),
    }))
    .filter((it) => it.productId && it.quantity > 0);

  if (cleaned.length === 0) {
    throw new Error('請至少選一個商品。數量需要大於 0。');
  }

  await assertMerchantRestockCatalogProducts(
    input.merchantId,
    cleaned.map((c) => c.productId),
    db,
  );

  return db.restockRequest.create({
    data: {
      merchantId: input.merchantId,
      requestedByMerchantUserId: input.merchantUserId,
      requestType: 'SELF_SELECT' satisfies RestockRequestType,
      status: 'submitted',
      merchantNote: input.merchantNote?.trim() || null,
      items: {
        create: cleaned.map((it) => ({
          productId: it.productId,
          requestedQuantity: it.quantity,
          approvedQuantity: it.quantity,
        })),
      },
    },
    include: { items: true },
  });
}

export async function submitAutoReplenishRestockRequest(
  input: SubmitAutoReplenishInput,
) {
  const note = input.merchantNote.trim();
  if (!note) {
    throw new Error('請填寫補貨需求');
  }

  return prisma.restockRequest.create({
    data: {
      merchantId: input.merchantId,
      requestedByMerchantUserId: input.merchantUserId,
      requestType: 'AUTO_REPLENISH' satisfies RestockRequestType,
      status: 'submitted',
      merchantNote: note,
    },
  });
}

export async function getRestockRequestForMerchant(
  requestId: string,
  merchantId: string,
) {
  return prisma.restockRequest.findFirst({
    where: { id: requestId, merchantId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
      },
      shipment: { select: { id: true, shipmentNumber: true, status: true } },
    },
  });
}

export type HqItemUpdate = {
  productId: string;
  approvedQuantity: unknown;
};

async function syncHqApprovedQuantities(
  tx: Prisma.TransactionClient,
  requestId: string,
  existingItemCount: number,
  lines: HqApprovedLine[],
) {
  if (existingItemCount === 0) {
    if (lines.length === 0) return;
    await tx.restockRequestItem.createMany({
      data: lines.map((line) => ({
        restockRequestId: requestId,
        productId: line.productId,
        requestedQuantity: null,
        approvedQuantity: line.approvedQuantity,
      })),
    });
    return;
  }

  for (const line of lines) {
    const updated = await tx.restockRequestItem.updateMany({
      where: {
        restockRequestId: requestId,
        productId: line.productId,
      },
      data: {
        approvedQuantity: line.approvedQuantity,
      },
    });
    if (updated.count !== 1) {
      throw new RestockRequestReviewError('申請品項不完整，請重新載入後再送出');
    }
  }
}

function resolvedHqItemLines(input: {
  existingItems: { productId: string; requestedQuantity: number | null }[];
  payload?: HqApprovedQtyPayload[] | null;
}): HqApprovedLine[] {
  if (!input.payload) {
    return input.existingItems.map((item) => ({
      productId: item.productId,
      requestedQuantity: item.requestedQuantity,
      approvedQuantity: 0,
    }));
  }
  const built = buildHqItemApprovals({
    existingItems: input.existingItems,
    payload: input.payload,
  });
  if (!built.ok) {
    throw new RestockRequestReviewError(built.error);
  }
  return built.lines;
}

export type HqReviewDb = Pick<
  typeof prisma,
  '$transaction' | 'restockRequest' | 'restockRequestItem' | 'product'
>;

export async function updateRestockRequestAsHq(
  input: {
    requestId: string;
    hqNote?: string | null;
    expectedArrivalDate?: Date | null;
    items: HqItemUpdate[];
  },
  db: HqReviewDb = prisma,
) {
  const existing = await db.restockRequest.findUnique({
    where: { id: input.requestId },
    include: { items: true },
  });
  if (!existing) throw new RestockRequestReviewError('申請不存在');
  assertHqReviewTransition({
    action: 'save',
    currentStatus: existing.status,
    shipmentId: existing.shipmentId,
  });

  const lines = resolvedHqItemLines({
    existingItems: existing.items,
    payload: input.items,
  });
  await assertJarExchangeProducts(lines.map((line) => line.productId), db);

  return db.$transaction(async (tx) => {
    const claimed = await tx.restockRequest.updateMany({
      where: {
        id: input.requestId,
        ...hqReviewClaimWhere('save'),
      },
      data: {
        hqNote: input.hqNote?.trim() || null,
        expectedArrivalDate: input.expectedArrivalDate ?? null,
        status:
          existing.status === 'submitted' ? 'under_review' : existing.status,
      },
    });
    if (hqReviewClaimCountIsConflict(claimed.count)) {
      throw new RestockRequestConflictError();
    }
    await syncHqApprovedQuantities(tx, input.requestId, existing.items.length, lines);
    return tx.restockRequest.findUniqueOrThrow({
      where: { id: input.requestId },
      include: {
        items: { include: { product: true } },
      },
    });
  });
}

export async function rejectRestockRequest(
  input: {
    requestId: string;
    hqUserId: string;
    hqNote?: string | null;
  },
  db: HqReviewDb = prisma,
) {
  const note = parseHqRejectNote(input.hqNote);
  const existing = await db.restockRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!existing) throw new RestockRequestReviewError('申請不存在');
  assertHqReviewTransition({
    action: 'reject',
    currentStatus: existing.status,
    shipmentId: existing.shipmentId,
  });

  const claimed = await db.restockRequest.updateMany({
    where: {
      id: input.requestId,
      ...hqReviewClaimWhere('reject'),
    },
    data: {
      status: 'rejected',
      rejectedAt: new Date(),
      approvedByUserId: input.hqUserId,
      hqNote: note,
    },
  });
  if (hqReviewClaimCountIsConflict(claimed.count)) {
    throw new RestockRequestConflictError();
  }
  return db.restockRequest.findUniqueOrThrow({
    where: { id: input.requestId },
  });
}

export type ApproveAndConvertDeps = {
  db?: HqReviewDb;
  createShipment?: typeof createRestockOrderWithShipment;
};

/**
 * Approve + convert to merchant_restock shipment in one transaction.
 * Idempotent: if already converted, returns existing shipmentId.
 */
export async function approveAndConvertRestockRequest(
  input: {
    requestId: string;
    hqUserId: string;
    expectedArrivalDate: Date;
    hqNote?: string | null;
    items?: HqApprovedQtyPayload[] | null;
  },
  deps: ApproveAndConvertDeps = {},
) {
  const db = deps.db ?? prisma;
  const convert = deps.createShipment ?? createRestockOrderWithShipment;

  if (
    !(input.expectedArrivalDate instanceof Date) ||
    Number.isNaN(input.expectedArrivalDate.getTime())
  ) {
    throw new RestockRequestReviewError('請填寫預計到貨日');
  }

  return db.$transaction(async (tx) => {
    const current = await tx.restockRequest.findUnique({
      where: { id: input.requestId },
      include: {
        items: true,
        merchant: true,
      },
    });
    if (!current) throw new RestockRequestReviewError('申請不存在');

    if (current.shipmentId) {
      return {
        request: current,
        shipmentId: current.shipmentId,
        idempotent: true as const,
      };
    }

    assertHqReviewTransition({
      action: 'approve',
      currentStatus: current.status,
      shipmentId: current.shipmentId,
    });

    let workingItems: Array<{ productId: string; approvedQuantity: number | null }> =
      current.items;
    if (shouldApplyHqItemPayload(current.status) && input.items) {
      const lines = resolvedHqItemLines({
        existingItems: current.items,
        payload: input.items,
      });
      assertApproveHasPositiveQty(lines);
      await assertJarExchangeProducts(
        lines.map((line) => line.productId),
        tx,
      );
      await syncHqApprovedQuantities(tx, current.id, current.items.length, lines);
      workingItems = lines.map((line) => ({
        productId: line.productId,
        approvedQuantity: line.approvedQuantity,
      }));
    }

    const claimed = await tx.restockRequest.updateMany({
      where: {
        id: input.requestId,
        ...hqReviewClaimWhere('approve'),
      },
      data: {
        status: 'approved',
        expectedArrivalDate: input.expectedArrivalDate,
        hqNote: input.hqNote?.trim() || undefined,
        approvedByUserId: input.hqUserId,
        approvedAt: new Date(),
      },
    });

    if (hqReviewClaimCountIsConflict(claimed.count)) {
      const raced = await tx.restockRequest.findUnique({
        where: { id: input.requestId },
      });
      if (raced?.shipmentId) {
        return {
          request: raced,
          shipmentId: raced.shipmentId,
          idempotent: true as const,
        };
      }
      throw new RestockRequestConflictError();
    }

    const lines = workingItems
      .map((it) => ({
        productId: it.productId,
        quantity: Math.floor(it.approvedQuantity ?? 0),
      }))
      .filter((it) => it.quantity > 0);

    if (lines.length === 0) {
      throw new RestockRequestReviewError('至少需要一個核准數量大於 0 的品項');
    }

    const products = await tx.product.findMany({
      where: { id: { in: lines.map((l) => l.productId) } },
    });
    if (products.some((p) => p.productCategory !== 'JAR_EXCHANGE')) {
      throw new RestockRequestReviewError('只能核准換罐計畫商品');
    }
    if (products.length !== lines.length) {
      throw new RestockRequestReviewError('商品資料不完整');
    }

    const productById = new Map(products.map((p) => [p.id, p]));
    const snapshot: ApprovedSnapshotLine[] = lines.map((l) => {
      const p = productById.get(l.productId)!;
      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: l.quantity,
      };
    });

    const noteParts = [
      `補貨申請 ${current.id.slice(0, 8)}`,
      current.merchantNote ? `店家：${current.merchantNote}` : null,
      input.hqNote?.trim() || current.hqNote
        ? `HQ：${input.hqNote?.trim() || current.hqNote}`
        : null,
      `預計到貨 ${input.expectedArrivalDate.toISOString().slice(0, 10)}`,
    ].filter(Boolean);

    const { shipment } = await convert(
      {
        merchantId: current.merchantId,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          weightGrams: null,
          unit: productById.get(l.productId)?.unit ?? null,
        })),
        products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
        recipientName: current.merchant.contactName ?? current.merchant.name,
        recipientPhone: current.merchant.phone,
        recipientAddress: current.merchant.address,
        carrier: current.merchant.preferredCarrier,
        notes: noteParts.join(' · '),
      },
      tx,
    );

    const updated = await tx.restockRequest.update({
      where: { id: current.id },
      data: {
        status: 'converted_to_shipment',
        shipmentId: shipment.id,
        approvedSnapshot: snapshot,
        expectedArrivalDate: input.expectedArrivalDate,
        hqNote: input.hqNote?.trim() || current.hqNote,
        approvedByUserId: input.hqUserId,
        approvedAt: current.approvedAt ?? new Date(),
      },
      include: { items: true },
    });

    return {
      request: updated,
      shipmentId: shipment.id,
      idempotent: false as const,
    };
  });
}

export async function ensureMerchantSettings(merchantId: string, db: Db = prisma) {
  return db.merchantSettings.upsert({
    where: { merchantId },
    create: { merchantId },
    update: {},
  });
}
