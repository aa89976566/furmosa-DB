import type { Prisma } from '@prisma/client';
import { nextStockTxnNumber } from '@/lib/merchant-stock-txn-number';
import {
  LEGACY_MERCHANT_STOCK_TIER_ID,
  merchantStockUniqueWhere,
} from '@/lib/merchant-stock-key';

type Db = Prisma.TransactionClient;

export type DepositStockResult = {
  balanceAfter: number;
  wentNegative: boolean;
  skipped?: boolean;
  reason?: string;
};

/**
 * 存罐成功後扣開戶店在店庫存（允許負庫存；冪等）。
 * 若序號尚未綁 productId，略過扣庫（仍可入點——由呼叫端決定是否允許）。
 */
export async function applyJarDepositStockDeduction(
  tx: Db,
  input: {
    locationId: string;
    productId: string | null;
    tierId?: string | null;
    jarCodeId: string;
    code: string;
    sourceSystem?: 'line' | 'hq';
  },
): Promise<DepositStockResult> {
  const idempotencyKey = `jar_redeem:${input.jarCodeId}`;
  const existing = await tx.merchantStockTxn.findUnique({
    where: { idempotencyKey },
    select: { balanceAfter: true },
  });
  if (existing) {
    return {
      balanceAfter: existing.balanceAfter,
      wentNegative: existing.balanceAfter < 0,
      skipped: true,
      reason: 'already_applied',
    };
  }

  if (!input.productId) {
    return {
      balanceAfter: 0,
      wentNegative: false,
      skipped: true,
      reason: 'missing_product',
    };
  }

  const tierId = input.tierId?.trim() || LEGACY_MERCHANT_STOCK_TIER_ID;
  const stockWhere = merchantStockUniqueWhere(
    input.locationId,
    input.productId,
    tierId,
  );

  const stock = await tx.merchantStock.upsert({
    where: stockWhere,
    update: {
      quantity: { decrement: 1 },
      lastSaleAt: new Date(),
    },
    create: {
      merchantId: input.locationId,
      productId: input.productId,
      tierId,
      quantity: -1,
      lastSaleAt: new Date(),
    },
  });

  const txnNumber = await nextStockTxnNumber(tx);
  await tx.merchantStockTxn.create({
    data: {
      txnNumber,
      merchantId: input.locationId,
      productId: input.productId,
      type: 'jar_redeem',
      eventType: 'jar_redeem',
      sourceSystem: input.sourceSystem ?? 'line',
      idempotencyKey,
      quantity: -1,
      balanceAfter: stock.quantity,
      note: `存罐序號 ${input.code}`,
    },
  });

  return {
    balanceAfter: stock.quantity,
    wentNegative: stock.quantity < 0,
  };
}
