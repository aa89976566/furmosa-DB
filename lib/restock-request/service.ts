import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createRestockOrderWithShipment } from '@/lib/merchant-restock-order';
import {
  RESTOCK_APPROVABLE_STATUSES,
  type ApprovedSnapshotLine,
  type RestockRequestType,
} from '@/lib/restock-request/constants';
import { isRestockableProductCategory } from '@/lib/product-category';
import { suggestedRestockQty } from '@/lib/pos/stock-status';

type Db = Prisma.TransactionClient | typeof prisma;

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
): Promise<MerchantRestockProduct[]> {
  const [jarProducts, stocks, rules] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: 'active',
        productCategory: { in: ['JAR_EXCHANGE', 'STANDARD'] },
      },
      select: {
        id: true,
        name: true,
        unit: true,
        productCategory: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.merchantStock.findMany({
      where: { merchantId },
      select: { productId: true, quantity: true },
    }),
    prisma.merchantProductRule.findMany({
      where: { merchantId },
      select: { productId: true },
    }),
  ]);

  const qtyByProduct = new Map<string, number>();
  for (const s of stocks) {
    qtyByProduct.set(s.productId, (qtyByProduct.get(s.productId) ?? 0) + s.quantity);
  }
  const inStore = new Set([...qtyByProduct.keys(), ...rules.map((r) => r.productId)]);

  return jarProducts
    .filter((p) => p.productCategory === 'JAR_EXCHANGE' || inStore.has(p.id))
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

export async function assertJarExchangeProducts(productIds: string[]) {
  if (productIds.length === 0) return;
  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, productCategory: true, name: true },
  });
  if (rows.length !== productIds.length) {
    throw new Error('有商品不存在');
  }
  const bad = rows.filter((r) => !isRestockableProductCategory(r.productCategory));
  if (bad.length > 0) {
    throw new Error('這項商品目前不能補貨');
  }
}

export async function submitSelfSelectRestockRequest(input: SubmitSelfSelectInput) {
  const cleaned = input.items
    .map((it) => ({
      productId: it.productId,
      quantity: Math.floor(Number(it.quantity)),
    }))
    .filter((it) => it.productId && it.quantity > 0);

  if (cleaned.length === 0) {
    throw new Error('請至少選一個商品。數量需要大於 0。');
  }

  await assertJarExchangeProducts(cleaned.map((c) => c.productId));

  return prisma.restockRequest.create({
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
      shipment: {
        select: {
          id: true,
          shipmentNumber: true,
          status: true,
          carrier: true,
          trackingNumber: true,
          packedAt: true,
          shippedAt: true,
          deliveredAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

export type HqItemUpdate = {
  id?: string;
  productId: string;
  requestedQuantity?: number | null;
  approvedQuantity: number;
};

export async function updateRestockRequestAsHq(input: {
  requestId: string;
  hqNote?: string | null;
  expectedArrivalDate?: Date | null;
  items: HqItemUpdate[];
}) {
  const existing = await prisma.restockRequest.findUnique({
    where: { id: input.requestId },
    include: { items: true },
  });
  if (!existing) throw new Error('申請不存在');
  if (existing.shipmentId || existing.status === 'converted_to_shipment') {
    throw new Error('已轉出貨單，無法再修改品項');
  }
  if (existing.status === 'rejected' || existing.status === 'cancelled') {
    throw new Error('此申請已結束');
  }

  await assertJarExchangeProducts(input.items.map((i) => i.productId));

  for (const it of input.items) {
    if (!Number.isFinite(it.approvedQuantity) || it.approvedQuantity < 0) {
      throw new Error('核准數量不可為負');
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.restockRequestItem.deleteMany({
      where: { restockRequestId: input.requestId },
    });
    if (input.items.length > 0) {
      await tx.restockRequestItem.createMany({
        data: input.items.map((it) => ({
          restockRequestId: input.requestId,
          productId: it.productId,
          requestedQuantity: it.requestedQuantity ?? null,
          approvedQuantity: Math.floor(it.approvedQuantity),
        })),
      });
    }
    return tx.restockRequest.update({
      where: { id: input.requestId },
      data: {
        hqNote: input.hqNote?.trim() || null,
        expectedArrivalDate: input.expectedArrivalDate ?? null,
        status:
          existing.status === 'submitted' ? 'under_review' : existing.status,
      },
      include: {
        items: { include: { product: true } },
      },
    });
  });
}

export async function rejectRestockRequest(input: {
  requestId: string;
  hqUserId: string;
  hqNote?: string | null;
}) {
  const existing = await prisma.restockRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!existing) throw new Error('申請不存在');
  if (existing.shipmentId || existing.status === 'converted_to_shipment') {
    throw new Error('已轉出貨單，無法拒絕');
  }
  if (existing.status === 'rejected' || existing.status === 'cancelled') {
    return existing;
  }

  return prisma.restockRequest.update({
    where: { id: input.requestId },
    data: {
      status: 'rejected',
      rejectedAt: new Date(),
      approvedByUserId: input.hqUserId,
      hqNote: input.hqNote?.trim() || existing.hqNote,
    },
  });
}

/**
 * Approve + convert to merchant_restock shipment in one transaction.
 * Idempotent: if already converted, returns existing shipmentId.
 */
export async function approveAndConvertRestockRequest(input: {
  requestId: string;
  hqUserId: string;
  expectedArrivalDate: Date;
  hqNote?: string | null;
}) {
  if (
    !(input.expectedArrivalDate instanceof Date) ||
    Number.isNaN(input.expectedArrivalDate.getTime())
  ) {
    throw new Error('請填寫預計到貨日');
  }

  return prisma.$transaction(async (tx) => {
    // Claim the row for conversion (prevents double-click duplicate shipments)
    const claimed = await tx.restockRequest.updateMany({
      where: {
        id: input.requestId,
        shipmentId: null,
        status: { in: RESTOCK_APPROVABLE_STATUSES },
      },
      data: {
        status: 'approved',
        expectedArrivalDate: input.expectedArrivalDate,
        hqNote: input.hqNote?.trim() || undefined,
        approvedByUserId: input.hqUserId,
        approvedAt: new Date(),
      },
    });

    const current = await tx.restockRequest.findUnique({
      where: { id: input.requestId },
      include: {
        items: true,
        merchant: true,
      },
    });
    if (!current) throw new Error('申請不存在');

    if (current.shipmentId) {
      return {
        request: current,
        shipmentId: current.shipmentId,
        idempotent: true as const,
      };
    }

    if (claimed.count === 0) {
      throw new Error('此申請目前無法核准');
    }

    const lines = current.items
      .map((it) => ({
        productId: it.productId,
        quantity: Math.floor(it.approvedQuantity ?? 0),
      }))
      .filter((it) => it.quantity > 0);

    if (lines.length === 0) {
      throw new Error('至少需要一個核准數量大於 0 的品項');
    }

    const products = await tx.product.findMany({
      where: { id: { in: lines.map((l) => l.productId) } },
    });
    if (products.some((p) => p.productCategory !== 'JAR_EXCHANGE')) {
      throw new Error('只能核准換罐計畫商品');
    }
    if (products.length !== lines.length) {
      throw new Error('商品資料不完整');
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

    const { shipment } = await createRestockOrderWithShipment(
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
  }, {
    maxWait: 10_000,
    timeout: 30_000,
  });
}

export async function ensureMerchantSettings(merchantId: string, db: Db = prisma) {
  return db.merchantSettings.upsert({
    where: { merchantId },
    create: { merchantId },
    update: {},
  });
}
