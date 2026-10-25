import { cumulativeShare, normalizeReceiptLines, type PartialReceiptLine } from './partial-receipt';
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

const receiptTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 15_000,
  timeout: 90_000,
};

function isRetryable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2034', 'P2024', 'P2028'].includes(error.code);
}

function retryPause(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, attempt * 750));
}

export async function receivePurchaseOrder(db: PrismaClient, purchaseOrderId: string, receivedById: string,
  submission?: { key: string; lines: PartialReceiptLine[] }) {
  if (!submission || !/^[0-9a-f-]{36}$/i.test(submission.key)) throw new Error('請重新開啟進貨單再收貨');
  const lines = normalizeReceiptLines(submission.lines);
  const hash = createHash('sha256').update(JSON.stringify({ purchaseOrderId, receivedById, lines })).digest('hex');
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM purchase_orders WHERE id = ${purchaseOrderId} FOR UPDATE`;
        const existing = await tx.purchaseReceipt.findUnique({ where: { submissionKey: submission.key } });
        if (existing) {
          if (existing.submissionHash !== hash) throw new Error('同一提交識別碼的收貨內容不同，請重新核對');
          return { receipt: existing, alreadyReceived: true };
        }
        const order = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: {
          items: { orderBy: { lineNumber: 'asc' } }, receipt: { include: { items: true } },
          receipts: { include: { items: true } },
        } });
        if (!order) throw new Error('找不到採購單');
        if (order.status !== 'pending_receipt') throw new Error('這張採購單已結案或作廢');
        if (lines.some(x => !order.items.some(i => i.id === x.lineId))) throw new Error('收貨品項不屬於此進貨單');
        const receipts = [...new Map([...(order.receipt ? [order.receipt] : []), ...order.receipts].map(x => [x.id,x])).values()];
        const states = order.items.map(item => {
          if (item.unit !== 'g') throw new Error('目前收貨僅支援已確認的 g 單位');
          const before = receipts.reduce((sum,r) => sum + r.items.filter(x => x.sourceOrderItemId === item.id || (!x.sourceOrderItemId && r.purchaseOrderId === order.id && x.productId === item.productId)).reduce((n,x) => n+x.quantityGrams,0),0);
          const quantity = lines.find(x => x.lineId === item.id)?.quantityGrams ?? 0;
          const after = before + quantity;
          if (after > item.quantityGrams) throw new Error(`${item.productName} 本次實收超過剩餘數量`);
          const total = Number(item.rawAmount.mul(100));
          return { item, before, after, quantity,
            oldAmount: cumulativeShare(total,before,item.quantityGrams),
            newAmount: cumulativeShare(total,after,item.quantityGrams) };
        });
        const subtotal = Number(order.subtotal.mul(100));
        const beforeAmount = states.reduce((sum,x) => sum+x.oldAmount,0);
        const afterAmount = states.reduce((sum,x) => sum+x.newAmount,0);
        const common = (value: Prisma.Decimal) => cumulativeShare(Number(value.mul(100)),afterAmount,subtotal)-cumulativeShare(Number(value.mul(100)),beforeAmount,subtotal);
        const receipt = await postPurchaseReceiptInTransaction(tx, {
          vendorId: order.vendorId, warehouseId: order.warehouseId, supplierDocumentNumber: null,
          receiptDate: new Date(), shippingCostCents: common(order.shippingCost), packagingCostCents: common(order.packagingCost),
          processingCostCents: common(order.processingCost), taxAmountCents: common(order.taxAmount), discountAmountCents: common(order.discountAmount),
          note: order.note, createdById: receivedById, sourceOrderId: order.id,
          submissionKey: submission.key, submissionHash: hash,
          items: states.filter(x => x.quantity > 0).map(x => ({ productId: x.item.productId, quantityGrams: x.quantity,
            rawAmountCents: x.newAmount-x.oldAmount, openingAverageCostPerGram: null, sourceLineId: x.item.id })), attachments: [],
        });
        if (states.every(x => x.after === x.item.quantityGrams)) await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: 'received', receivedById, receivedAt: new Date() } });
        return { receipt, alreadyReceived: false };
      }, receiptTransactionOptions);
    } catch (error) {
      if (!isRetryable(error) || attempt === 3) throw error;
      await retryPause(attempt);
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
