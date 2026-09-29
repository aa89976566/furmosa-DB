import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient, type StocktakeAdjustment } from '@prisma/client';

export type StocktakeInput = {
  eventKey: string;
  productId: string;
  warehouseId: string;
  afterQuantity: number;
  afterTotalCostCents: number;
  reason: string;
  createdById: string;
};

function resolveExistingStocktake(
  existing: StocktakeAdjustment | null,
  input: StocktakeInput,
) {
  if (!existing) return null;
  const expectedTotalCost = new Prisma.Decimal(input.afterTotalCostCents).div(100);
  const sameIntent = existing.productId === input.productId
    && existing.warehouseId === input.warehouseId
    && existing.afterQuantity === input.afterQuantity
    && existing.afterTotalCost.equals(expectedTotalCost)
    && existing.reason === input.reason.trim();
  if (!sameIntent) {
    throw new Error('這個盤點識別碼已用於不同內容，請重新開啟盤點頁再提交');
  }
  return { adjustment: existing, alreadyApplied: true as const };
}

export async function applyStocktake(db: PrismaClient, input: StocktakeInput) {
  if (!input.eventKey.trim()) throw new Error('盤點識別碼不可空白');
  if (!Number.isSafeInteger(input.afterQuantity) || input.afterQuantity < 0) throw new Error('盤點後克數必須是 0 以上整數');
  if (!Number.isSafeInteger(input.afterTotalCostCents) || input.afterTotalCostCents < 0) throw new Error('盤點後總成本格式不正確');
  if (!input.reason.trim()) throw new Error('請填寫盤點原因');
  if (input.afterQuantity === 0 && input.afterTotalCostCents !== 0) throw new Error('零庫存的總成本必須為 0');
  if (input.afterQuantity > 0 && input.afterTotalCostCents === 0) throw new Error('有庫存時總成本必須大於 0');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
    const existing = await tx.stocktakeAdjustment.findUnique({ where: { eventKey: input.eventKey } });
    const existingResult = resolveExistingStocktake(existing, input);
    if (existingResult) return existingResult;
    const [product, balances] = await Promise.all([
      tx.product.findUnique({ where: { id: input.productId }, select: { id: true, name: true, averageCostPerGram: true } }),
      tx.inventoryBalance.findMany({ where: { productId: input.productId } }),
    ]);
    if (!product) throw new Error('找不到商品');
    if (balances.some((balance) => balance.warehouseId !== input.warehouseId && balance.quantity !== 0)) {
      throw new Error(`${product.name} 在其他自有倉庫仍有庫存，不能用單一主倉盤點改寫全域成本`);
    }
    const balance = balances.find((row) => row.warehouseId === input.warehouseId);
    const beforeQuantity = balance?.quantity ?? 0;
    const beforeUnitCost = product.averageCostPerGram ?? new Prisma.Decimal(0);
    const beforeTotalCost = beforeUnitCost.mul(beforeQuantity).toDecimalPlaces(2);
    const afterTotalCost = new Prisma.Decimal(input.afterTotalCostCents).div(100);
    const afterUnitCost = input.afterQuantity === 0
      ? new Prisma.Decimal(0)
      : afterTotalCost.div(input.afterQuantity).toDecimalPlaces(6);
    const deltaQuantity = input.afterQuantity - beforeQuantity;
    const deltaTotalCost = afterTotalCost.minus(beforeTotalCost);
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const transaction = await tx.inventoryTransaction.create({
      data: {
        txnNumber: `INV-${date}-COUNT-${suffix}`,
        eventKey: `stocktake:${input.eventKey}`,
        type: 'stocktake',
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: deltaQuantity,
        unit: 'g',
        unitCost: Number(afterUnitCost),
        reference: input.eventKey,
        note: input.reason.trim(),
      },
    });
    await tx.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: input.productId, warehouseId: input.warehouseId } },
      create: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.afterQuantity,
        unit: 'g',
        lastCountedAt: new Date(),
        countNote: input.reason.trim(),
      },
      update: {
        quantity: input.afterQuantity,
        unit: 'g',
        lastCountedAt: new Date(),
        countNote: input.reason.trim(),
      },
    });
    await tx.product.update({ where: { id: input.productId }, data: { averageCostPerGram: afterUnitCost } });
    const adjustment = await tx.stocktakeAdjustment.create({
      data: {
        eventKey: input.eventKey,
        productId: input.productId,
        warehouseId: input.warehouseId,
        inventoryTransactionId: transaction.id,
        beforeQuantity,
        afterQuantity: input.afterQuantity,
        deltaQuantity,
        beforeTotalCost,
        afterTotalCost,
        deltaTotalCost,
        reason: input.reason.trim(),
        createdById: input.createdById,
      },
    });
    return { adjustment, alreadyApplied: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code);
      if (!retryable || attempt === 3) throw error;
      const existing = await db.stocktakeAdjustment.findUnique({ where: { eventKey: input.eventKey } });
      const existingResult = resolveExistingStocktake(existing, input);
      if (existingResult) return existingResult;
    }
  }
  throw new Error('盤點調整失敗');
}
