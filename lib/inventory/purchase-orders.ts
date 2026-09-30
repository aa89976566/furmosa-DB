import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { postPurchaseReceiptInTransaction, type PurchaseAttachmentInput } from './post-purchase-receipt';

export type PurchaseOrderLineInput = { productId: string; quantityGrams: number; rawAmountCents: number };
export type CreatePurchaseOrderInput = {
  vendorId: string | null;
  warehouseId: string;
  supplierDocumentNumber: string | null;
  remindFromDate: Date;
  shippingCostCents: number;
  packagingCostCents: number;
  processingCostCents: number;
  taxAmountCents: number;
  discountAmountCents: number;
  note: string | null;
  createdById: string;
  items: PurchaseOrderLineInput[];
  attachments: PurchaseAttachmentInput[];
};

const money = (cents: number) => new Prisma.Decimal(cents).div(100);

export function formatTaipeiCalendarDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function validate(input: CreatePurchaseOrderInput) {
  if (!input.items.length) throw new Error('至少需要一個採購品項');
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) throw new Error('同一商品請合併成一列');
  for (const item of input.items) {
    if (!Number.isSafeInteger(item.quantityGrams) || item.quantityGrams <= 0) throw new Error('採購克數必須為正整數');
    if (!Number.isSafeInteger(item.rawAmountCents) || item.rawAmountCents <= 0) throw new Error('品項金額必須大於 0');
  }
  const subtotalCents = input.items.reduce((sum, item) => sum + item.rawAmountCents, 0);
  const totalCents = subtotalCents + input.shippingCostCents + input.packagingCostCents +
    input.processingCostCents + input.taxAmountCents - input.discountAmountCents;
  if (totalCents < 0) throw new Error('折扣不可高於本次總成本');
  return { subtotalCents, totalCents };
}

export async function createPurchaseOrder(db: PrismaClient, input: CreatePurchaseOrderInput) {
  const { subtotalCents, totalCents } = validate(input);
  const products = await db.product.findMany({
    where: { id: { in: input.items.map((item) => item.productId) }, status: { not: 'inactive' } },
    select: { id: true, name: true, sku: true },
  });
  if (products.length !== input.items.length) throw new Error('部分商品不存在或已停用');
  const stamp = formatTaipeiCalendarDate(input.remindFromDate).replaceAll('-', '');
  const orderNumber = `PO-${stamp}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
  return db.$transaction(async (tx) => tx.purchaseOrder.create({
    data: {
      orderNumber,
      vendorId: input.vendorId,
      warehouseId: input.warehouseId,
      supplierDocumentNumber: input.supplierDocumentNumber,
      remindFromDate: input.remindFromDate,
      subtotal: money(subtotalCents),
      shippingCost: money(input.shippingCostCents),
      packagingCost: money(input.packagingCostCents),
      processingCost: money(input.processingCostCents),
      taxAmount: money(input.taxAmountCents),
      discountAmount: money(input.discountAmountCents),
      totalAmount: money(totalCents),
      note: input.note,
      createdById: input.createdById,
      items: { create: input.items.map((item, index) => {
        const product = products.find((row) => row.id === item.productId)!;
        return {
          lineNumber: index + 1,
          productId: item.productId,
          productName: product.name,
          sku: product.sku,
          quantityGrams: item.quantityGrams,
          rawAmount: money(item.rawAmountCents),
        };
      }) },
      attachments: { create: input.attachments.map((file) => ({
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.data.byteLength,
        sha256: createHash('sha256').update(file.data).digest('hex'),
        data: file.data,
      })) },
    },
  }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function isRetryable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

export async function receivePurchaseOrder(db: PrismaClient, purchaseOrderId: string, receivedById: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.purchaseReceipt.findUnique({ where: { purchaseOrderId } });
        if (existing) return { receipt: existing, alreadyReceived: true };
        const claim = await tx.purchaseOrder.updateMany({
          where: { id: purchaseOrderId, status: 'pending_receipt' },
          data: { status: 'received', receivedById, receivedAt: new Date() },
        });
        if (claim.count !== 1) {
          const current = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { receipt: true } });
          if (!current) throw new Error('找不到採購單');
          if (current.status === 'cancelled') throw new Error('這張採購單已作廢');
          if (current.status === 'received' && current.receipt) return { receipt: current.receipt, alreadyReceived: true };
          throw new Error('採購單狀態異常，請停止操作並聯繫管理員');
        }
        const order = await tx.purchaseOrder.findUnique({
          where: { id: purchaseOrderId },
          include: { items: { orderBy: { lineNumber: 'asc' } } },
        });
        if (!order) throw new Error('找不到採購單');
        const receipt = await postPurchaseReceiptInTransaction(tx, {
          vendorId: order.vendorId,
          warehouseId: order.warehouseId,
          supplierDocumentNumber: order.supplierDocumentNumber,
          receiptDate: new Date(),
          shippingCostCents: Number(order.shippingCost.mul(100)),
          packagingCostCents: Number(order.packagingCost.mul(100)),
          processingCostCents: Number(order.processingCost.mul(100)),
          taxAmountCents: Number(order.taxAmount.mul(100)),
          discountAmountCents: Number(order.discountAmount.mul(100)),
          note: order.note,
          createdById: receivedById,
          purchaseOrderId,
          items: order.items.map((item) => ({
            productId: item.productId,
            quantityGrams: item.quantityGrams,
            rawAmountCents: Number(item.rawAmount.mul(100)),
            openingAverageCostPerGram: null,
            sourceLineId: item.id,
          })),
          attachments: [],
        });
        return { receipt, alreadyReceived: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isRetryable(error) || attempt === 3) throw error;
    }
  }
  throw new Error('確認實收失敗');
}

export function purchaseOrderIsDue(remindFromDate: Date, reference = new Date()) {
  const taipeiDay = formatTaipeiCalendarDate(reference);
  return remindFromDate <= new Date(`${taipeiDay}T23:59:59.999+08:00`);
}

export function allPurchaseLinesConfirmed(expectedIds: string[], submittedIds: string[]) {
  const submitted = new Set(submittedIds);
  return expectedIds.length > 0 && submitted.size === expectedIds.length && expectedIds.every((id) => submitted.has(id));
}
