/**
 * 換罐交付／預留／口味後台 → MerchantStock。
 * 使用 Spec refill_* txn types，避免進入寄賣分潤結算。
 */

import type { Prisma } from '@prisma/client';
import {
  LEGACY_MERCHANT_STOCK_TIER_ID,
  merchantStockUniqueWhere,
} from '@/lib/merchant-stock-key';
import { nextStockTxnNumber } from '@/lib/merchant-stock-txn-number';

type Tx = Prisma.TransactionClient;

export const REFILL_STOCK_TXN = {
  reservation: 'refill_reservation',
  delivery: 'refill_delivery',
  release: 'refill_release',
} as const;

const REFILL_DELIVERY_NOTE_PREFIX = 'refill_delivery:';
const REFILL_RESERVATION_NOTE_PREFIX = 'refill_reservation:';
const REFILL_RELEASE_NOTE_PREFIX = 'refill_release:';
const REFILL_ADMIN_NOTE_PREFIX = 'refill_admin_sync:';

export function refillDeliveryNote(orderId: string) {
  return `${REFILL_DELIVERY_NOTE_PREFIX}${orderId}`;
}

export function refillReservationNote(orderId: string) {
  return `${REFILL_RESERVATION_NOTE_PREFIX}${orderId}`;
}

export function refillReleaseNote(orderId: string) {
  return `${REFILL_RELEASE_NOTE_PREFIX}${orderId}`;
}

export function refillAdminSyncNote(storeId: string) {
  return `${REFILL_ADMIN_NOTE_PREFIX}${storeId}`;
}

/** 結算排除：換罐相關 note／type 不得當寄賣銷售 */
export function isRefillInventoryNote(note: string | null | undefined): boolean {
  if (!note) return false;
  return (
    note.startsWith(REFILL_DELIVERY_NOTE_PREFIX) ||
    note.startsWith(REFILL_RESERVATION_NOTE_PREFIX) ||
    note.startsWith(REFILL_RELEASE_NOTE_PREFIX) ||
    note.startsWith(REFILL_ADMIN_NOTE_PREFIX)
  );
}

export function isRefillStockTxnType(type: string): boolean {
  return (
    type === REFILL_STOCK_TXN.reservation ||
    type === REFILL_STOCK_TXN.delivery ||
    type === REFILL_STOCK_TXN.release
  );
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
        // 仍用 adjust，但 note 前綴會被結算排除
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
 * 付款成功後軟預留（有 productId 才做）。
 * 庫存不足時不擋付款、不扣帳，只回傳 shortfall。
 */
export async function tryReserveRefillStock(opts: {
  tx: Tx;
  merchantId: string;
  productId: string;
  orderId: string;
  qty?: number;
}): Promise<{ reserved: boolean; balanceAfter: number; reason?: string }> {
  const qty = Math.max(1, Math.floor(opts.qty ?? 1));
  const note = refillReservationNote(opts.orderId);

  const existing = await opts.tx.merchantStockTxn.findFirst({
    where: {
      merchantId: opts.merchantId,
      note: { startsWith: REFILL_RESERVATION_NOTE_PREFIX + opts.orderId },
      type: REFILL_STOCK_TXN.reservation,
    },
    select: { id: true, balanceAfter: true },
  });
  if (existing) {
    return { reserved: true, balanceAfter: existing.balanceAfter, reason: 'already' };
  }

  const stockWhere = merchantStockUniqueWhere(
    opts.merchantId,
    opts.productId,
    LEGACY_MERCHANT_STOCK_TIER_ID,
  );
  const stock = await opts.tx.merchantStock.findUnique({ where: stockWhere });
  const prev = stock?.quantity ?? 0;
  if (prev < qty) {
    return { reserved: false, balanceAfter: prev, reason: 'shortfall' };
  }

  const nextQty = prev - qty;
  const updated = await opts.tx.merchantStock.update({
    where: { id: stock!.id },
    data: { quantity: nextQty, lastSaleAt: new Date() },
  });

  const txnNumber = await nextStockTxnNumber(opts.tx);
  await opts.tx.merchantStockTxn.create({
    data: {
      txnNumber,
      merchantId: opts.merchantId,
      productId: opts.productId,
      type: REFILL_STOCK_TXN.reservation,
      quantity: -qty,
      balanceAfter: updated.quantity,
      note,
    },
  });

  return { reserved: true, balanceAfter: updated.quantity };
}

/**
 * 換罐交付扣庫存（refill_delivery）。
 * 若已有 reservation，改記 delivery 並釋放 reservation 語意（不重複扣）。
 * 冪等：同一 orderId 不重複扣。
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

  const existingDelivery = await opts.tx.merchantStockTxn.findFirst({
    where: {
      merchantId: opts.merchantId,
      OR: [
        { type: REFILL_STOCK_TXN.delivery, note: { startsWith: note } },
        // Phase 2 legacy
        { type: 'adjust', note: { startsWith: note } },
      ],
    },
    select: { id: true, balanceAfter: true, quantity: true },
  });
  if (existingDelivery) {
    return {
      deducted: Math.abs(existingDelivery.quantity),
      balanceAfter: existingDelivery.balanceAfter,
      alreadyPosted: true,
    };
  }

  const reservation = await opts.tx.merchantStockTxn.findFirst({
    where: {
      merchantId: opts.merchantId,
      productId: opts.productId,
      type: REFILL_STOCK_TXN.reservation,
      note: refillReservationNote(opts.orderId),
    },
    select: { id: true, balanceAfter: true },
  });

  // 已預留：庫存已扣，只補一筆 delivery 標記（quantity 0）避免再扣
  if (reservation) {
    const stockWhere = merchantStockUniqueWhere(
      opts.merchantId,
      opts.productId,
      LEGACY_MERCHANT_STOCK_TIER_ID,
    );
    const stock = await opts.tx.merchantStock.findUnique({ where: stockWhere });
    const balanceAfter = stock?.quantity ?? reservation.balanceAfter;
    const txnNumber = await nextStockTxnNumber(opts.tx);
    await opts.tx.merchantStockTxn.create({
      data: {
        txnNumber,
        merchantId: opts.merchantId,
        productId: opts.productId,
        type: REFILL_STOCK_TXN.delivery,
        quantity: 0,
        balanceAfter,
        note: `${note}（consume_reservation）`,
      },
    });
    return { deducted: qty, balanceAfter, alreadyPosted: false };
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
      type: REFILL_STOCK_TXN.delivery,
      quantity: txnQty,
      balanceAfter: stock.quantity,
      note: deducted < qty ? `${note}（庫存不足：原 ${prev}）` : note,
    },
  });

  return { deducted: qty, balanceAfter: stock.quantity, alreadyPosted: false };
}
