import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * 為 Store 補齊缺少的 active flavour 庫存列。
 * - 僅 INSERT 缺列
 * - 預設 quantity=0、is_available=true
 * - 不覆蓋既有 quantity / is_available
 * - 可重複執行
 */
export async function ensureMissingRefillStockRowsForStore(
  db: Db,
  storeId: string,
): Promise<{ inserted: number; skippedExisting: number }> {
  const flavours = await db.refillFlavour.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (flavours.length === 0) {
    return { inserted: 0, skippedExisting: 0 };
  }

  const existing = await db.merchantRefillStock.findMany({
    where: {
      storeId,
      flavourId: { in: flavours.map((f) => f.id) },
    },
    select: { flavourId: true },
  });
  const have = new Set(existing.map((e) => e.flavourId));
  const missing = flavours.filter((f) => !have.has(f.id));
  if (missing.length === 0) {
    return { inserted: 0, skippedExisting: existing.length };
  }

  const now = new Date();
  await db.merchantRefillStock.createMany({
    data: missing.map((f) => ({
      id: randomUUID(),
      storeId,
      flavourId: f.id,
      quantity: 0,
      isAvailable: true,
      createdAt: now,
      updatedAt: now,
    })),
    skipDuplicates: true,
  });

  return {
    inserted: missing.length,
    skippedExisting: existing.length,
  };
}
