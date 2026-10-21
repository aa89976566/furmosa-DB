import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { COUNT_ROLES, inventoryUnit } from './workbench';
export class QuantityCountError extends Error {
}
export type CountLine = {
    productId: string;
    quantity: number;
    expectedVersion: string | null;
};
export type CountCommand = {
    eventKey: string;
    actorId: string;
    reason: string;
    lines: CountLine[];
};
/** Quantity-only stocktake. Costs and purchasing stay in their existing workflows. */
export async function countInventoryQuantities(db: PrismaClient, command: CountCommand) {
    const { lines } = command;
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(command.eventKey) || !command.reason.trim() || command.reason.length > 300 ||
        !lines.length || lines.length > 100 || new Set(lines.map(l => l.productId)).size !== lines.length ||
        lines.some(l => !l.productId || !Number.isSafeInteger(l.quantity) || l.quantity < 0 || l.quantity > 2147483647 ||
            (l.expectedVersion !== null && (typeof l.expectedVersion !== 'string' || Number.isNaN(Date.parse(l.expectedVersion)))))) {
        throw new QuantityCountError('盤點內容無效，請重新核對');
    }
    const hash = createHash('sha256').update(JSON.stringify({ actorId: command.actorId,
        reason: command.reason.trim(), lines: [...lines].sort((a, b) => a.productId.localeCompare(b.productId)) })).digest('hex');
    const batchKey = `quantity-count:${command.eventKey}`;
    const sortedLines = [...lines].sort((a, b) => a.productId.localeCompare(b.productId));
    try {
        return await db.$transaction(async (tx) => {
            const actor = await tx.user.findUnique({ where: { id: command.actorId }, select: { id: true, name: true, role: true } });
            if (!actor || !COUNT_ROLES.includes(actor.role))
                throw new QuantityCountError('你沒有更新庫存權限');
            const warehouse = await tx.warehouse.findUnique({ where: { code: 'WH-MAIN' }, select: { id: true } });
            if (!warehouse)
                throw new QuantityCountError('找不到 HQ 主倉，請聯絡管理員');
            const previous = await tx.inventoryTransaction.findMany({ where: { OR: [{ eventKey: batchKey }, { eventKey: { startsWith: `${batchKey}:` } }] } });
            if (previous.length) {
                if (previous.length !== lines.length || previous.some(p => p.reference !== hash)) {
                    throw new QuantityCountError('這次更新識別碼已用於其他內容，請重新整理');
                }
                return { count: previous.length, alreadyApplied: true };
            }
            const now = new Date();
            for (const [index, line] of sortedLines.entries()) {
                const product = await tx.product.findUnique({ where: { id: line.productId },
                    select: { id: true, name: true, status: true, unit: true, productCategory: true } });
                if (!product || product.status !== 'active' || product.productCategory !== 'STANDARD') {
                    throw new QuantityCountError('部分商品已停用或不適用一般庫存，請重新整理');
                }
                const balance = await tx.inventoryBalance.findUnique({ where: { productId_warehouseId: {
                            productId: product.id, warehouseId: warehouse.id
                        } } });
                if ((balance?.updatedAt.toISOString() ?? null) !== line.expectedVersion) {
                    throw new QuantityCountError(`${product.name} 的庫存已變更，請重新整理並重新清點；本次沒有儲存`);
                }
                // Never reinterpret a legacy non-zero balance or convert grams into packs.
                const unit = inventoryUnit(balance?.unit);
                if (!unit || unit !== inventoryUnit(product.unit)) {
                    throw new QuantityCountError(`${product.name} 的庫存單位尚未確認，請先由管理員核對`);
                }
                if (balance!.quantity === line.quantity)
                    throw new QuantityCountError(`${product.name} 的數量未變更，請移除此項後再提交`);
                const delta = line.quantity - balance!.quantity;
                if (delta < -2147483648 || delta > 2147483647)
                    throw new QuantityCountError('數量差異超過可儲存範圍');
                const updated = await tx.inventoryBalance.updateMany({ where: { id: balance!.id, updatedAt: balance!.updatedAt },
                    data: { quantity: line.quantity, lastCountedAt: now, countNote: command.reason.trim() } });
                if (updated.count !== 1)
                    throw new QuantityCountError(`${product.name} 的庫存已變更，請重新清點`);
                const transaction = await tx.inventoryTransaction.create({ data: {
                        txnNumber: `INV-${now.toISOString().slice(0, 10).replaceAll('-', '')}-COUNT-${randomUUID()}`,
                        eventKey: index === 0 ? batchKey : `${batchKey}:${product.id}`, type: 'stocktake',
                        productId: product.id, warehouseId: warehouse.id, quantity: delta, unit,
                        reference: hash, note: `${command.reason.trim()} · ${actor.name} · ${balance!.quantity} → ${line.quantity} ${unit}`,
                    } });
                await tx.statusAuditLog.create({ data: {
                        entityType: 'inventory_count', entityId: transaction.id, actorType: 'user', actorId: actor.id,
                        previousStatus: String(balance!.quantity), newStatus: String(line.quantity),
                        metadataJson: JSON.stringify({ eventKey: command.eventKey, productId: product.id, warehouseId: warehouse.id,
                            unit, beforeQuantity: balance!.quantity, afterQuantity: line.quantity, reason: command.reason.trim() }),
                    } });
            }
            return { count: lines.length, alreadyApplied: false };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 3000, timeout: 15000 });
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
            throw new QuantityCountError('庫存同時被更新，請重新整理確認；不要重複提交');
        }
        throw error;
    }
}
