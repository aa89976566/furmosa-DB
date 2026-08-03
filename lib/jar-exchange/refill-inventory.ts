/**
 * 換罐交付／口味後台 → MerchantStock 雙寫。
 * txn type 用 adjust（避免 sale 進入寄賣分潤結算）。
 */

import type { Prisma } from '@prisma/client';
import {
  LEGACY_MERCHANT_STOCK_TIER_ID,
  merchantStockUniqueWhere,
} from '@/lib/merchant-stock-key';
import { nextStockTxnNumber } from '@/lib/merchant-stock-txn-number';

type Tx = Prisma.TransactionClient;

const REFILL_DELIVERY_NOTE_PREFIX = 'refill_delivery:';
const REFILL_ADMIN_NOTE_PREFIX = 'refill_admin_sync:';

export function refillDeliveryNote(orderId: string) {
  return `${REFILL_DELIVERY_NOTE_PREFIX}${orderId}`;
}

export function refillAdminSyncNote(storeId: string) {
  return `${REFILL_ADMIN_NOTE_PREFIX}${storeId}`;
}

/** 口味後台設定數量 → 對齊 MerchantStock 絕對值 */
export async function syncMerchantStockAbsolute(opts: {
  tx: Tx;
  merchantId: string;
  productId: string;
  quantity: number;
  note: string;
}): Promise<{ balanceAfter: number; delta: number }> {
  const qty = Math.max(0, Math.floor(opts.quantity));
  const stockWhere = merchantStockUniqueWhere(
    opts.merchantId,
    opts.productId,
    LEGACY_MERCHANT_STOCK_TIER_ID,
  );
  const existing = await opts.tx.merchantStock.findUnique({ where: stockWhere });
  const prev = existing?.quantity ?? 0;
  const delta = qty - prev;

  const stock = await opts.tx.merchantStock.upsert({
    where: stockWhere,
    update: {
      quantity: qty,
      ...(delta > 0 ? { lastRestockAt: new Date() } : {}),
      ...(delta < 0 ? { lastSaleAt: new Date() } : {}),
    },
    create: {
      merchantId: opts.merchantId,
      productId: opts.productId,
      tierId: LEGACY_MERCHANT_STOCK_TIER_ID,
      quantity: qty,
      lastRestockAt: delta > 0 ? new Date() : undefined,
    },
  });

  if (delta !== 0) {
    const txnNumber = await nextStockTxnNumber(opts.tx);
    await opts.tx.merchantStockTxn.create({
      data: {
        txnNumber,
        merchantId: opts.merchantId,
        productId: opts.productId,
        type: 'adjust',
        quantity: delta,
        balanceAfter: stock.quantity,
        note: opts.note,
      },
    });
  }

  return { balanceAfter: stock.quantity, delta };
}

/**
 * 換罐交付扣 1 罐。冪等：同一 orderId 不重複扣。
 * 庫存不足時仍扣到 0 以下？——不允許負庫存；改為扣到 0 並回傳 shortfall。
 */
export async function applyRefillDeliveryStockDeduct(opts: {
  tx: Tx;
  merchantId: string;
  productId: string;
  orderId: string;
  qty?: number;
}): Promise<{ deducted: number; balanceAfter: number; alreadyPosted: boolean }> {
  const qty = Math.max(1, Math.floor(opts.qty ?? 1));
  const note = refillDeliveryNote(opts.orderId);

  const existingTxn = await opts.tx.merchantStockTxn.findFirst({
    where: {
      merchantId: opts.merchantId,
      productId: opts.productId,
      type: 'adjust',
      note,
    },
    select: { id: true, balanceAfter: true, quantity: true },
  });
  if (existingTxn) {
    return {
      deducted: Math.abs(existingTxn.quantity),
      balanceAfter: existingTxn.balanceAfter,
      alreadyPosted: true,
    };
  }

  const stockWhere = merchantStockUniqueWhere(
    opts.merchantId,
    opts.productId,
    LEGACY_MERCHANT_STOCK_TIER_ID,
  );
  const existing = await opts.tx.merchantStock.findUnique({ where: stockWhere });
  const prev = existing?.quantity ?? 0;
  const deducted = Math.min(prev, qty);
  const nextQty = Math.max(0, prev - qty);
  // 若原本不足，仍記實際意圖：quantity 記 −qty，balance 不低於 0
  const txnQty = -qty;

  const stock = await opts.tx.merchantStock.upsert({
    where: stockWhere,
    update: { quantity: nextQty, lastSaleAt: new Date() },
    create: {
      merchantId: opts.merchantId,
      productId: opts.productId,
      tierId: LEGACY_MERCHANT_STOCK_TIER_ID,
      quantity: nextQty,
      lastSaleAt: new Date(),
    },
  });

  const txnNumber = await nextStockTxnNumber(opts.tx);
  await opts.tx.merchantStockTxn.create({
    data: {
      txnNumber,
      merchantId: opts.merchantId,
      productId: opts.productId,
      type: 'adjust',
      quantity: txnQty,
      balanceAfter: stock.quantity,
      note:
        deducted < qty
          ? `${note}（庫存不足：原 ${prev}）`
          : note,
    },
  });

  return { deducted: qty, balanceAfter: stock.quantity, alreadyPosted: false };
}
