import { packagedOrderUnit } from '@/lib/product-units';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertCarrierHomeOrDeliveryRecipient } from '@/lib/shipping-policy';

const pad = (n: number, width = 3) => String(n).padStart(width, '0');

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type RestockDb = Prisma.TransactionClient | typeof prisma;

export async function nextRestockOrderNumber(db: RestockDb = prisma) {
  const prefix = `ORD-${ymd()}-`;
  const last = await db.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
  });
  const seq = last ? Number(last.orderNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 3)}`;
}

export async function nextRestockShipmentNumber(db: RestockDb = prisma) {
  const prefix = `SHP-${ymd()}-`;
  const last = await db.shipment.findFirst({
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
  variantKey?: string | null;
  unit: string | null;
};

type RestockProduct = {
  id: string;
  name: string;
  sku: string;
  price?: number;
  priceTiers?: Array<{ id: string; weightGrams: number | null; price: number }>;
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
  assertCarrierHomeOrDeliveryRecipient(input.carrier, {
    recipientName: input.recipientName,
    recipientPhone: input.recipientPhone,
    recipientAddress: input.recipientAddress,
  });
  const db = tx ?? prisma;
  const productById = new Map(input.products.map((p) => [p.id, p]));
  // Snapshot the selected catalog price before writing either document.
  const pricedItems = input.items.map((it) => {
    const product = productById.get(it.productId);
    if (!product) throw new Error('商品不存在');
    const tiers = product.priceTiers ?? [];
    const matches = it.variantKey
      ? tiers.filter((tier) => tier.id === it.variantKey)
      : it.weightGrams != null
        ? tiers.filter((tier) => tier.weightGrams === it.weightGrams)
        : tiers.length === 1 ? tiers : [];
    if (tiers.length && matches.length !== 1) throw new Error(`「${product.name}」請確認補貨商品規格`);
    const tier = matches[0];
    if (tier && it.weightGrams != null && tier.weightGrams !== it.weightGrams) throw new Error(`「${product.name}」規格克數不一致`);
    const unitPrice = tier?.price ?? product.price;
    if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`「${product.name}」尚未設定有效單價，請先更新商品規格`);
    return { ...it, unitPrice, subtotal: Math.round(unitPrice * it.quantity * 100) / 100 };
  });
  const orderNumber = await nextRestockOrderNumber(db);
  const shipmentNumber = input.shipmentNumber ?? (await nextRestockShipmentNumber(db));

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
        create: pricedItems.map((it) => {
          const p = productById.get(it.productId);
          if (!p) throw new Error('商品不存在');
          return {
            productId: it.productId,
            productName: p.name,
            sku: p.sku,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            subtotal: it.subtotal,
            weightGrams: it.weightGrams,
            unit: packagedOrderUnit(it.unit, it.weightGrams),
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
        create: pricedItems.map((it) => {
          const p = productById.get(it.productId);
          if (!p) throw new Error('商品不存在');
          return {
            productId: it.productId,
            productName: p.name,
            sku: p.sku,
            quantity: it.quantity,
            weightGrams: it.weightGrams && it.weightGrams > 0 ? it.weightGrams : null,
            variantKey: it.variantKey ?? null,
            unit: packagedOrderUnit(it.unit, it.weightGrams),
          };
        }),
      },
    },
  });

  return { order, shipment };
}

/** 舊進貨單尚未掛 Order 時補建（cron／節流維護可重跑） */
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

  if (orphans.length === 0) return 0;

  const prefix = `ORD-${ymd()}-`;
  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  let seq = last ? Number(last.orderNumber.slice(prefix.length)) + 1 : 1;

  let linked = 0;
  for (const s of orphans) {
    if (!s.merchantId) continue;
    const orderNumber = `${prefix}${pad(seq, 3)}`;
    seq += 1;
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
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
              unit: packagedOrderUnit(it.unit, it.weightGrams),
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
