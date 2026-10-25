import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { inventoryUnit } from './workbench';

export class UnitConfirmationError extends Error {}
export type UnitConfirmation = {
  eventKey: string; actorId: string; productId: string; quantity: number;
  unit: string; expectedVersion: string | null; expectedProductVersion: string; reason: string;
};

/** Explicit physical recount, never a weight-to-pack conversion. Append-only ledger. */
export async function confirmInventoryUnit(db: PrismaClient, input: UnitConfirmation) {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.eventKey)
    || !input.productId || !inventoryUnit(input.unit) || !Number.isSafeInteger(input.quantity)
    || input.quantity < 0 || input.quantity > 2147483647 || !input.reason.trim() || input.reason.length > 300
    || Number.isNaN(Date.parse(input.expectedProductVersion))
    || (input.expectedVersion !== null && Number.isNaN(Date.parse(input.expectedVersion)))) {
    throw new UnitConfirmationError('核對內容無效，請重新開啟核對頁');
  }
  const eventKey = `unit-confirm:${input.eventKey}`;
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  try {
    return await db.$transaction(async tx => {
      const actor = await tx.user.findUnique({ where: { id: input.actorId }, select: { role: true, name: true } });
      if (actor?.role !== 'admin') throw new UnitConfirmationError('只有管理員可以核對庫存單位');
      const previous = await tx.inventoryTransaction.findUnique({ where: { eventKey } });
      if (previous) {
        if (previous.reference !== hash) throw new UnitConfirmationError('核對識別碼已用於其他內容，請重新開啟核對頁');
        return { alreadyApplied: true };
      }
      const product = await tx.product.findUnique({ where: { id: input.productId },
        select: { id: true, status: true, productCategory: true, unit: true, updatedAt: true } });
      if (!product || product.status !== 'active' || product.productCategory !== 'STANDARD')
        throw new UnitConfirmationError('此商品不適用一般庫存核對');
      if (product.updatedAt.toISOString() !== input.expectedProductVersion || inventoryUnit(product.unit) !== input.unit)
        throw new UnitConfirmationError('商品設定已變更，請重新開啟核對頁');
      const warehouse = await tx.warehouse.findUnique({ where: { code: 'WH-MAIN' }, select: { id: true } });
      if (!warehouse) throw new UnitConfirmationError('找不到 HQ 主倉');
      const balances = await tx.inventoryBalance.findMany({ where: { productId: product.id } });
      const balance = balances.find(b => b.warehouseId === warehouse.id);
      if ((balance?.updatedAt.toISOString() ?? null) !== input.expectedVersion)
        throw new UnitConfirmationError('庫存已變更，請重新開啟核對頁；本次沒有儲存');
      if (balances.some(b => b.warehouseId !== warehouse.id && b.quantity !== 0))
        throw new UnitConfirmationError('其他倉庫仍有庫存，請先一起核對單位');
      if (balance && inventoryUnit(balance.unit) === input.unit)
        throw new UnitConfirmationError('單位已一致，請改用一般盤點數量');
      const now = new Date();
      const before = { quantity: balance?.quantity ?? 0, unit: balance?.unit ?? null };
      // Close the old unit separately: subtracting grams from packs is not meaningful.
      if (before.quantity !== 0) {
        if (before.quantity === -2147483648) throw new UnitConfirmationError('舊數量超過可修正範圍');
        await tx.inventoryTransaction.create({ data: {
          txnNumber: `INV-UNIT-CLOSE-${randomUUID()}`, eventKey: `${eventKey}:close`,
          type: 'adjustment', productId: product.id, warehouseId: warehouse.id,
          quantity: -before.quantity, unit: before.unit, reference: hash,
          note: `單位核對：結清舊記錄 ${before.quantity} ${before.unit ?? '未確認'}；${input.reason.trim()}`,
        } });
      }
      const transaction = await tx.inventoryTransaction.create({ data: {
        txnNumber: `INV-UNIT-COUNT-${randomUUID()}`, eventKey, type: 'stocktake',
        productId: product.id, warehouseId: warehouse.id, quantity: input.quantity, unit: input.unit,
        reference: hash, note: `實際盤點 ${input.quantity} ${input.unit}；${input.reason.trim()} · ${actor.name}`,
      } });
      const data = { quantity: input.quantity, unit: input.unit, lastCountedAt: now, countNote: input.reason.trim() };
      if (balance) {
        const result = await tx.inventoryBalance.updateMany({ where: { id: balance.id, updatedAt: balance.updatedAt }, data });
        if (result.count !== 1) throw new UnitConfirmationError('庫存已變更，請重新核對');
      } else {
        await tx.inventoryBalance.create({ data: { productId: product.id, warehouseId: warehouse.id, ...data } });
      }
      await tx.statusAuditLog.create({ data: {
        entityType: 'inventory_unit_confirmation', entityId: transaction.id, actorType: 'user', actorId: input.actorId,
        previousStatus: `${before.quantity} ${before.unit ?? '未確認'}`, newStatus: `${input.quantity} ${input.unit}`,
        metadataJson: JSON.stringify({ productId: product.id, warehouseId: warehouse.id, before,
          after: { quantity: input.quantity, unit: input.unit }, reason: input.reason.trim(), eventKey }),
      } });
      return { alreadyApplied: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 3000, timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code))
      throw new UnitConfirmationError('庫存同時被更新，請重新整理確認；不要重複提交');
    throw error;
  }
}
