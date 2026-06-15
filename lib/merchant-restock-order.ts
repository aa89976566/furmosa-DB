import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const pad = (n: number, width = 3) => String(n).padStart(width, '0');

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function nextRestockOrderNumber() {
  const prefix = `ORD-${ymd()}-`;
  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
  });
  const seq = last ? Number(last.orderNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 3)}`;
}

export async function nextRestockShipmentNumber() {
  const prefix = `SHP-${ymd()}-`;
  const last = await prisma.shipment.findFirst({
    where: { shipmentNumber: { startsWith: prefix } },
    orderBy: { shipmentNumber: 'desc' },
  });
  const seq = last ? Number(last.shipmentNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 4)}`;
}

type RestockLine = {
  productId: string;
  quantity: number;
  weightGrams: number | null;
  unit: string | null;
};

type RestockProduct = {
  id: string;
  name: string;
  sku: string;
};

export type CreateRestockOrderInput = {
  merchantId: string;
  items: RestockLine[];
  products: RestockProduct[];
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  carrier: string | null;
  notes: string | null;
  shipmentNumber?: string;
  paymentStatus?: string;
  shippingFeeType?: string;
  shippingMethod?: string;
  shippingFee?: number;
  companyShippingCost?: number;
  discount?: number;
  total?: number;
  cvsBrand?: string | null;
};

/** 店家進貨：同時建立 Order（列表）+ Shipment（出貨隊列） */
export async function createRestockOrderWithShipment(
  input: CreateRestockOrderInput,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  const productById = new Map(input.products.map((p) => [p.id, p]));
  const orderNumber = await nextRestockOrderNumber();
  const shipmentNumber = input.shipmentNumber ?? (await nextRestockShipmentNumber());

  const order = await db.order.create({
    data: {
      orderNumber,
      source: 'consignment',
      status: 'confirmed',
      paymentStatus: input.paymentStatus ?? 'paid',
      shippingFeeType: input.shippingFeeType ?? 'unpaid',
      fulfillmentStatus: 'pending',
      merchantId: input.merchantId,
      subtotal: 0,
      discount: input.discount ?? 0,
      shippingFee: input.shippingFee ?? 0,
      companyShippingCost: input.companyShippingCost ?? 0,
      total: input.total ?? input.shippingFee ?? 0,
      shippingMethod: input.shippingMethod ?? 'delivery',
      cvsBrand: input.cvsBrand ?? null,
      shippingAddress: input.recipientAddress ?? '',
      note: input.notes ?? '寄賣店進貨補貨',
      orderedAt: new Date(),
      items: {
        create: input.items.map((it) => {
          const p = productById.get(it.productId);
          if (!p) throw new Error('商品不存在');
          return {
            productId: it.productId,
            productName: p.name,
            sku: p.sku,
            quantity: it.quantity,
            unitPrice: 0,
            subtotal: 0,
            weightGrams: it.weightGrams,
            unit: it.unit,
          };
        }),
      },
    },
  });

  const shipment = await db.shipment.create({
    data: {
      shipmentNumber,
      type: 'merchant_restock',
      status: 'pending',
      merchantId: input.merchantId,
      orderId: order.id,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      recipientAddress: input.recipientAddress,
      carrier: input.carrier,
      notes: input.notes,
      items: {
        create: input.items.map((it) => {
          const p = productById.get(it.productId);
          if (!p) throw new Error('商品不存在');
          return {
            productId: it.productId,
            productName: p.name,
            sku: p.sku,
            quantity: it.quantity,
            weightGrams: it.weightGrams && it.weightGrams > 0 ? it.weightGrams : null,
            unit: it.unit,
          };
        }),
      },
    },
  });

  return { order, shipment };
}

/** 舊進貨單尚未掛 Order 時補建（載入隊列時可重跑） */
export async function ensureOrdersForOrphanRestockShipments(): Promise<number> {
  const orphans = await prisma.shipment.findMany({
    where: {
      type: 'merchant_restock',
      orderId: null,
      status: { in: ['pending', 'packed', 'shipped'] },
    },
    include: {
      items: true,
      merchant: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  let linked = 0;
  for (const s of orphans) {
    if (!s.merchantId) continue;
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: await nextRestockOrderNumber(),
          source: 'consignment',
          status: 'confirmed',
          paymentStatus: 'paid',
          fulfillmentStatus:
            s.status === 'delivered'
              ? 'delivered'
              : s.status === 'shipped'
                ? 'shipped'
                : 'pending',
          merchantId: s.merchantId,
          subtotal: 0,
          total: 0,
          shippingMethod: 'delivery',
          shippingAddress: s.recipientAddress ?? '',
          note: s.notes ?? `補登進貨單 ${s.shipmentNumber}`,
          orderedAt: s.createdAt,
          shippedAt: s.shippedAt,
          items: {
            create: s.items.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              sku: it.sku,
              quantity: it.quantity,
              unitPrice: 0,
              subtotal: 0,
              weightGrams: it.weightGrams,
              unit: it.unit,
            })),
          },
        },
      });
      await tx.shipment.update({
        where: { id: s.id },
        data: { orderId: order.id },
      });
    });
    linked++;
  }
  return linked;
}

/** 舊 source=restock 併入寄賣 */
export async function migrateRestockOrdersToConsignment(): Promise<number> {
  const result = await prisma.order.updateMany({
    where: { source: 'restock' },
    data: { source: 'consignment' },
  });
  return result.count;
}
