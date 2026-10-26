import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { allocateCommonCost, receiptAverageCost, type PurchaseCostLine } from './purchase-cost';

export type PurchaseAttachmentInput = { fileName: string; mimeType: string; data: Buffer };
export type PostPurchaseReceiptInput = {
  vendorId: string | null;
  warehouseId: string;
  supplierDocumentNumber: string | null;
  receiptDate: Date | null;
  shippingCostCents: number;
  packagingCostCents: number;
  processingCostCents: number;
  taxAmountCents: number;
  discountAmountCents: number;
  note: string | null;
  createdById: string;
  items: PurchaseCostLine[];
  attachments: PurchaseAttachmentInput[];
  purchaseOrderId?: string | null;
  sourceOrderId?: string;
  submissionKey?: string;
  submissionHash?: string;
};

const money = (cents: number) => new Prisma.Decimal(cents).div(100);
const gramCost = (value: number) => new Prisma.Decimal(value.toFixed(6));
const receiptTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 15_000,
  timeout: 90_000,
};
export const purchaseReceiptEventKey = (purchaseOrderId: string, lineId: string) => `purchase-order:${purchaseOrderId}:${lineId}`;

function receiptCosts(input: PostPurchaseReceiptInput) {
  if (!input.items.length) throw new Error('至少需要一個進貨品項');
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
    throw new Error('同一商品請合併成一列');
  }
  const subtotalCents = input.items.reduce((sum, item) => sum + item.rawAmountCents, 0);
  const commonCostCents = input.shippingCostCents + input.packagingCostCents +
    input.processingCostCents + input.taxAmountCents - input.discountAmountCents;
  const totalCents = subtotalCents + commonCostCents;
  if (totalCents < 0) throw new Error('折扣不可高於本次總成本');
  return { subtotalCents, totalCents, allocations: subtotalCents === 0 && commonCostCents === 0 && input.sourceOrderId ? input.items.map(() => 0) : allocateCommonCost(input.items, commonCostCents) };
}

export async function postPurchaseReceipt(db: PrismaClient, input: PostPurchaseReceiptInput) {
  receiptCosts(input);
  if (!input.submissionKey || !/^[0-9a-f-]{36}$/i.test(input.submissionKey)) {
    throw new Error('請重新開啟新增進貨頁面再提交');
  }
  const submissionHash = createHash('sha256').update(JSON.stringify({
    ...input, submissionHash: undefined,
    attachments: input.attachments.map(file => ({
      fileName: file.fileName, mimeType: file.mimeType,
      sha256: createHash('sha256').update(file.data).digest('hex'),
    })),
  })).digest('hex');
  input = { ...input, submissionHash };
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const date = (input.receiptDate ?? new Date()).toISOString().slice(0, 10).replaceAll('-', '');
  const receiptNumber = `PUR-${date}-${suffix}`;

  try {
  return await db.$transaction(async (tx) => {
    const existing = await tx.purchaseReceipt.findUnique({ where: { submissionKey: input.submissionKey } });
    if (existing) {
      if (existing.submissionHash !== submissionHash) throw new Error('這次提交已入庫，但內容不同；請先查看進貨紀錄');
      return existing;
    }
    return postPurchaseReceiptInTransaction(tx, input, {
    receiptNumber,
    transactionSuffix: suffix,
    transactionDate: date,
  });
  }, receiptTransactionOptions);
  } catch (error) {
    // A competing transaction may have committed this same key while we waited.
    // Read only after the losing transaction has rolled back completely.
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      const existing = await db.purchaseReceipt.findUnique({ where: { submissionKey: input.submissionKey } });
      if (existing) {
        if (existing.submissionHash !== submissionHash) throw new Error('這次提交已入庫，但內容不同；請先查看進貨紀錄');
        return existing;
      }
      throw new Error('入庫遇到同時更新，請保留原表單重試，並先查看進貨紀錄');
    }
    throw error;
  }
}

export async function postPurchaseReceiptInTransaction(
  tx: Prisma.TransactionClient,
  input: PostPurchaseReceiptInput,
  generated?: { receiptNumber: string; transactionSuffix: string; transactionDate: string },
) {
    const { subtotalCents, totalCents, allocations } = receiptCosts(input);
    const localSuffix = generated?.transactionSuffix ?? randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    const localDate = generated?.transactionDate ?? (input.receiptDate ?? new Date()).toISOString().slice(0, 10).replaceAll('-', '');
    const localReceiptNumber = generated?.receiptNumber ?? `PUR-${localDate}-${localSuffix}`;
    const products = await tx.product.findMany({
      where: { id: { in: input.items.map((item) => item.productId) }, status: { not: 'inactive' } },
      select: { id: true, name: true, averageCostPerGram: true },
    });
    if (products.length !== input.items.length) throw new Error('部分商品不存在或已停用');

    const receipt = await tx.purchaseReceipt.create({
      data: {
        receiptNumber: localReceiptNumber,
        supplierDocumentNumber: input.supplierDocumentNumber,
        receiptDate: input.receiptDate,
        vendorId: input.vendorId,
        warehouseId: input.warehouseId,
        subtotal: money(subtotalCents),
        shippingCost: money(input.shippingCostCents),
        packagingCost: money(input.packagingCostCents),
        processingCost: money(input.processingCostCents),
        taxAmount: money(input.taxAmountCents),
        discountAmount: money(input.discountAmountCents),
        totalAmount: money(totalCents),
        note: input.note,
        createdById: input.createdById,
        purchaseOrderId: input.purchaseOrderId ?? null,
        sourceOrderId: input.sourceOrderId,
        submissionKey: input.submissionKey,
        submissionHash: input.submissionHash,
      },
    });

    for (const [index, item] of input.items.entries()) {
      if (!Number.isSafeInteger(item.quantityGrams) || item.quantityGrams <= 0) throw new Error('實收克數必須為正整數');
      if (!Number.isSafeInteger(item.rawAmountCents) || (input.sourceOrderId ? item.rawAmountCents < 0 : item.rawAmountCents <= 0)) throw new Error('品項金額必須大於 0');
      const product = products.find((row) => row.id === item.productId)!;
      const balances = await tx.inventoryBalance.findMany({ where: { productId: item.productId } });
      if (balances.some((balance) => balance.quantity !== 0 && balance.unit !== 'g')) {
        throw new Error(`${product.name} 的現有庫存單位尚未確認為 g，請先完成盤點`);
      }
      const previousStockGrams = balances.reduce((sum, balance) => sum + balance.quantity, 0);
      const allocatedCostCents = allocations[index]!;
      const landedAmountCents = item.rawAmountCents + allocatedCostCents;
      if (landedAmountCents < 0) throw new Error(`${product.name} 分攤後成本不可為負數`);
      const previousAverage = product.averageCostPerGram == null
        ? previousStockGrams > 0 ? item.openingAverageCostPerGram : 0
        : Number(product.averageCostPerGram);
      if (previousAverage == null) {
        throw new Error(`${product.name} 已有舊庫存，請填寫首次建檔平均成本/g`);
      }
      let costing;
      try {
        costing = receiptAverageCost({ previousStockGrams, previousAverageCostPerGram: previousAverage, receivedGrams: item.quantityGrams, landedAmountCents });
      } catch (error) {
        const detail = error instanceof Error ? error.message : '成本異常';
        throw new Error(`${product.name} 目前 ${previousStockGrams}g，本次 ${item.quantityGrams}g，${detail}，請先完成盤點`);
      }
      const { resultingStockGrams, averageCostPerGram: newAverage } = costing;
      const txn = await tx.inventoryTransaction.create({
        data: {
          txnNumber: `INV-${localDate}-${localSuffix}-${String(index + 1).padStart(2, '0')}`,
          eventKey: input.purchaseOrderId
            ? purchaseReceiptEventKey(input.purchaseOrderId, item.sourceLineId ?? item.productId)
            : `purchase:${receipt.id}:${item.productId}`,
          type: 'purchase_in',
          productId: item.productId,
          warehouseId: input.warehouseId,
          quantity: item.quantityGrams,
          unit: 'g',
          unitCost: Number((landedAmountCents / 100 / item.quantityGrams).toFixed(6)),
          reference: receipt.receiptNumber,
          note: input.supplierDocumentNumber ? `供應商單號 ${input.supplierDocumentNumber}` : 'HQ 進貨入庫',
        },
      });
      await tx.inventoryBalance.upsert({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: input.warehouseId } },
        create: { productId: item.productId, warehouseId: input.warehouseId, quantity: item.quantityGrams, unit: 'g' },
        update: { quantity: { increment: item.quantityGrams }, unit: 'g' },
      });
      await tx.product.update({
        where: { id: item.productId },
        data: { averageCostPerGram: gramCost(newAverage) },
      });
      await tx.purchaseReceiptItem.create({
        data: {
          purchaseReceiptId: receipt.id,
          productId: item.productId,
          sourceOrderItemId: input.sourceOrderId ? item.sourceLineId : null,
          inventoryTransactionId: txn.id,
          quantityGrams: item.quantityGrams,
          rawAmount: money(item.rawAmountCents),
          allocatedCost: money(allocatedCostCents),
          landedAmount: money(landedAmountCents),
          costPerGram: gramCost(landedAmountCents / 100 / item.quantityGrams),
          previousStockGrams,
          resultingStockGrams,
          previousAverageCostPerGram: gramCost(previousAverage),
          newAverageCostPerGram: gramCost(newAverage),
        },
      });
    }

    if (input.attachments.length) {
      await tx.purchaseReceiptAttachment.createMany({
        data: input.attachments.map((file) => ({
          purchaseReceiptId: receipt.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.data.byteLength,
          sha256: createHash('sha256').update(file.data).digest('hex'),
          data: file.data,
        })),
      });
    }
    return receipt;
}
