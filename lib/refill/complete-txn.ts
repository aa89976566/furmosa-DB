import type { Prisma } from '@prisma/client';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';
import { appendPointsLedger } from '@/lib/jar-exchange/points';
import { assertTransition } from '@/lib/refill/transitions';
import { RefillError } from '@/lib/refill/errors';
import { writeRefillAudit } from '@/lib/refill/audit';
import type { RefillOrderStatus } from '@/lib/refill/constants';
import { decrementFlavourStockInTxn } from '@/lib/refill/store-stock';

type Tx = Prisma.TransactionClient;

/** 兩段式驗舊罐：只在呼叫端已開啟的 transaction 內執行 */
export async function verifyOldContainerInTxn(
  tx: Tx,
  input: {
    orderId: string;
    customerId: string;
    merchantId: string;
    actorId: string;
    serial: string;
    /** 允許的訂單狀態（預設 paid_waiting_return） */
    expectedOrderStatus?: RefillOrderStatus;
  },
): Promise<{ serial: string }> {
  const expected = input.expectedOrderStatus ?? 'paid_waiting_return';
  const order = await tx.refillOrder.findUnique({ where: { id: input.orderId } });
  if (!order) throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);
  if (order.status !== expected) {
    throw new RefillError('這筆訂單目前不能驗空罐。', 'INVALID_STATUS', 409);
  }
  if (order.deliveryMode === 'first') {
    throw new RefillError('這筆是首罐／補差額訂單，不需要回收空罐。', 'NO_OLD_JAR_NEEDED', 400);
  }
  if (!order.paidAt) {
    throw new RefillError('尚未付款，不能交付。', 'UNPAID', 409);
  }

  const jar = await tx.jarCode.findUnique({ where: { code: input.serial } });
  if (!jar) throw new RefillError('找不到這個序號。', 'SERIAL_NOT_FOUND', 404);
  if (jar.redeemedByCustomerId !== input.customerId) {
    throw new RefillError('這個序號不屬於這位會員。', 'SERIAL_NOT_OWNED', 409);
  }
  if (jar.status !== 'issued') {
    throw new RefillError(
      jar.status === 'returned' || jar.status === 'used'
        ? '這個序號已經使用過。'
        : '這個序號目前不能回收。',
      'SERIAL_USED',
      409,
    );
  }
  if (jar.lockedByRefillOrderId && jar.lockedByRefillOrderId !== order.id) {
    throw new RefillError('這個序號已被其他訂單使用。', 'SERIAL_LOCKED', 409);
  }

  assertTransition('paid_waiting_return', 'old_container_verified');

  await tx.jarCode.update({
    where: { id: jar.id },
    data: { lockedByRefillOrderId: order.id },
  });

  await tx.refillOrder.update({
    where: { id: order.id },
    data: {
      status: 'old_container_verified',
      oldContainerSerial: input.serial,
    },
  });

  await writeRefillAudit(tx, {
    refillOrderId: order.id,
    action: 'old_container_verified',
    actorType: 'merchant',
    actorId: input.actorId,
    merchantId: input.merchantId,
    serial: input.serial,
  });

  return { serial: input.serial };
}

export type CompleteInTxnResult =
  | { alreadyCompleted: true; pointsAwarded: false }
  | {
      alreadyCompleted: false;
      pointsAwarded: boolean;
      fulfilledFlavourId: string;
      oldSerial: string | null;
      newSerial: string;
    };

/**
 * 單一 transaction 內完成交付。
 * one-shot（oldSerial 有值且訂單仍為 paid_waiting_return）時，
 * 舊罐驗證／lock／returned 與扣庫存／綁新罐／completed 同 txn，失敗全 rollback。
 */
export async function completeRefillInTxn(
  tx: Tx,
  input: {
    orderId: string;
    merchantId: string;
    actorId: string;
    storeId: string;
    fulfilledFlavourId: string;
    newSerial: string;
    /** one-shot：在同 txn 內驗舊罐；兩段式則傳 null，使用訂單上既有 oldContainerSerial */
    oldSerialRaw?: string | null;
  },
): Promise<CompleteInTxnResult> {
  const newSerial = normalizeJarCode(input.newSerial);
  if (!isValidJarCodeFormat(newSerial)) {
    throw new RefillError('新罐序號須為 8 位數字。', 'INVALID_SERIAL', 400);
  }

  const fresh = await tx.refillOrder.findUnique({ where: { id: input.orderId } });
  if (!fresh) throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);
  if (fresh.status === 'completed') {
    return { alreadyCompleted: true, pointsAwarded: false };
  }

  const isFirstPath = fresh.deliveryMode === 'first' || fresh.orderType === 'first';
  const oneShotSerial = input.oldSerialRaw
    ? normalizeJarCode(input.oldSerialRaw)
    : null;
  if (oneShotSerial && !isValidJarCodeFormat(oneShotSerial)) {
    throw new RefillError('序號須為 8 位數字。', 'INVALID_SERIAL', 400);
  }

  let working = fresh;
  let expectedStatus: RefillOrderStatus;

  if (isFirstPath) {
    expectedStatus = 'paid_waiting_return';
  } else if (fresh.status === 'paid_waiting_return' && oneShotSerial) {
    // one-shot：先在同 txn 驗舊罐（尚未 commit），狀態變 old_container_verified
    await verifyOldContainerInTxn(tx, {
      orderId: fresh.id,
      customerId: fresh.customerId,
      merchantId: input.merchantId,
      actorId: input.actorId,
      serial: oneShotSerial,
      expectedOrderStatus: 'paid_waiting_return',
    });
    const afterVerify = await tx.refillOrder.findUnique({ where: { id: fresh.id } });
    if (!afterVerify) throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);
    working = afterVerify;
    expectedStatus = 'old_container_verified';
  } else if (fresh.status === 'old_container_verified') {
    expectedStatus = 'old_container_verified';
  } else {
    throw new RefillError('請先確認收到空罐。', 'NEED_OLD_JAR', 409);
  }

  if (!working.paidAt && expectedStatus !== 'old_container_verified') {
    const paidPayment = await tx.paymentOrder.findFirst({
      where: { refillOrderId: working.id, status: 'paid' },
    });
    if (!paidPayment) {
      throw new RefillError('尚未付款，不能交付。', 'UNPAID', 409);
    }
  }

  assertTransition(expectedStatus, 'completed');
  const now = new Date();

  // 原子佔用 completedAt，防止雙店員同時交付
  const claimed = await tx.refillOrder.updateMany({
    where: {
      id: working.id,
      status: expectedStatus,
      completedAt: null,
    },
    data: { completedAt: now },
  });
  if (claimed.count === 0) {
    const again = await tx.refillOrder.findUnique({ where: { id: working.id } });
    if (again?.status === 'completed') {
      return { alreadyCompleted: true, pointsAwarded: false };
    }
    throw new RefillError('這筆訂單目前不能交付，或已由其他人完成。', 'INVALID_STATUS', 409);
  }

  const newJar = await tx.jarCode.findUnique({ where: { code: newSerial } });
  if (!newJar) throw new RefillError('找不到新罐序號。', 'SERIAL_NOT_FOUND', 404);
  if (newJar.status !== 'unused' && !(newJar.status === 'issued' && !newJar.redeemedByCustomerId)) {
    if (newJar.redeemedByCustomerId && newJar.redeemedByCustomerId !== working.customerId) {
      throw new RefillError('這個新罐序號已被其他會員使用。', 'SERIAL_USED', 409);
    }
    if (newJar.status === 'issued' || newJar.status === 'returned' || newJar.status === 'used') {
      throw new RefillError('這個序號已經使用過。', 'SERIAL_USED', 409);
    }
  }

  // 舊罐回收（exchange）
  if (!isFirstPath && working.oldContainerSerial) {
    const old = await tx.jarCode.findUnique({
      where: { code: working.oldContainerSerial },
    });
    if (!old || old.redeemedByCustomerId !== working.customerId) {
      throw new RefillError('舊罐序號驗證失敗。', 'SERIAL_NOT_OWNED', 409);
    }
    if (old.status === 'issued') {
      await tx.jarCode.update({
        where: { id: old.id },
        data: {
          status: 'returned',
          returnedAt: now,
          returnedMerchantId: input.merchantId,
          lockedByRefillOrderId: working.id,
        },
      });
    } else if (old.status !== 'returned' || old.lockedByRefillOrderId !== working.id) {
      throw new RefillError('這個序號已經使用過。', 'SERIAL_USED', 409);
    }
  }

  await decrementFlavourStockInTxn(tx, {
    storeId: input.storeId,
    flavourId: input.fulfilledFlavourId,
    actorUserId: input.actorId,
    refillOrderId: working.id,
    note: `fulfill:${working.id}`,
  });

  await tx.jarCode.update({
    where: { id: newJar.id },
    data: {
      status: 'issued',
      redeemedByCustomerId: working.customerId,
      issuedAt: now,
      issuedMerchantId: input.merchantId,
      lockedByRefillOrderId: null,
    },
  });

  let pointsAwarded = false;
  const shouldAward =
    !isFirstPath && working.orderType === 'exchange' && !working.pointsAwardedAt;
  if (shouldAward) {
    const existing = await tx.memberPointsLedger.findFirst({
      where: {
        sourceType: 'refill_completed',
        sourceRefId: working.id,
      },
    });
    if (!existing) {
      await appendPointsLedger(tx, {
        customerId: working.customerId,
        sourceType: 'refill_completed',
        sourceRefId: working.id,
        pointsChange: 1,
        note: `換罐完成 ${working.id}`,
      });
      pointsAwarded = true;
    }
  }

  await tx.refillOrder.update({
    where: { id: working.id },
    data: {
      status: 'completed',
      newContainerSerial: newSerial,
      fulfilledFlavourId: input.fulfilledFlavourId,
      fulfilledByUserId: input.actorId,
      completedAt: now,
      oldContainerReturnedAt: !isFirstPath ? now : working.oldContainerReturnedAt,
      pointsAwardedAt: pointsAwarded || working.pointsAwardedAt ? now : working.pointsAwardedAt,
    },
  });

  await writeRefillAudit(tx, {
    refillOrderId: working.id,
    action: 'refill_completed',
    actorType: 'merchant',
    actorId: input.actorId,
    merchantId: input.merchantId,
    serial: newSerial,
    detail: {
      oldSerial: working.oldContainerSerial,
      preferredFlavourId: working.preferredFlavourId,
      fulfilledFlavourId: input.fulfilledFlavourId,
      storeId: input.storeId,
      pointsAwarded,
      deliveryMode: working.deliveryMode,
      oneShot: Boolean(oneShotSerial),
    },
  });

  return {
    alreadyCompleted: false,
    pointsAwarded,
    fulfilledFlavourId: input.fulfilledFlavourId,
    oldSerial: working.oldContainerSerial,
    newSerial,
  };
}
