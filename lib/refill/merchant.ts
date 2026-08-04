import { prisma } from '@/lib/prisma';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';
import { appendPointsLedger, getPointsBalance } from '@/lib/jar-exchange/points';
import { assertTransition } from '@/lib/refill/transitions';
import { RefillError } from '@/lib/refill/errors';
import { writeRefillAudit } from '@/lib/refill/audit';
import { notifyRefillCompleted } from '@/lib/refill/notify';
import { REFILL_PAID_OPEN_STATUSES } from '@/lib/refill/constants';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { initiateRefillPayment } from '@/lib/refill/payment';
import {
  classifyCompleteOrderConflict,
  classifyVerifyOrderConflict,
  expectedCompleteFromStatus,
  interpretClaimCount,
  isFirstDeliveryPath,
  isPointsLedgerUniqueConflict,
} from '@/lib/refill/integrity-lock';

export async function listMerchantRefillOrders(merchantId: string) {
  const rows = await prisma.refillOrder.findMany({
    where: {
      merchantId,
      status: {
        in: [...REFILL_PAID_OPEN_STATUSES, 'payment_pending', 'completed'],
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 50,
    include: {
      appointment: {
        select: { startsAt: true, petName: true, serviceName: true },
      },
      customer: { select: { name: true } },
      payments: {
        where: { status: 'paid' },
        select: { amount: true, purpose: true },
      },
    },
  });

  return rows.map((o) => ({
    id: o.id,
    status: o.status,
    orderType: o.orderType,
    deliveryMode: o.deliveryMode,
    totalAmount: o.totalAmount,
    petName: o.petName ?? o.appointment.petName,
    customerName: o.customer.name,
    date: formatLocalDate(o.appointment.startsAt),
    time: formatLocalTime(o.appointment.startsAt),
    startsAt: o.appointment.startsAt.toISOString(),
    paid: Boolean(o.paidAt) || o.payments.length > 0,
    oldContainerSerial: o.oldContainerSerial,
    newContainerSerial: o.newContainerSerial,
    missingContainerNote: o.missingContainerNote,
    productLabel:
      o.deliveryMode === 'first' || o.orderType === 'first' ? '首罐' : '雞肉換罐',
  }));
}

async function loadMerchantOrder(orderId: string, merchantId: string) {
  const order = await prisma.refillOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, name: true, lineUserId: true } },
      merchant: { select: { id: true, name: true } },
      appointment: { select: { startsAt: true, petName: true, status: true } },
    },
  });
  if (!order) throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);
  if (order.merchantId !== merchantId) {
    throw new RefillError(
      `這筆訂單只能在${order.merchant.name}領取。`,
      'WRONG_STORE',
      403,
    );
  }
  return order;
}

export async function verifyOldContainer(input: {
  orderId: string;
  merchantId: string;
  actorId: string;
  serialRaw: string;
}) {
  const serial = normalizeJarCode(input.serialRaw);
  if (!isValidJarCodeFormat(serial)) {
    throw new RefillError('序號須為 8 位數字。', 'INVALID_SERIAL', 400);
  }

  const order = await loadMerchantOrder(input.orderId, input.merchantId);

  if (order.deliveryMode === 'first') {
    throw new RefillError('這筆是首罐／補差額訂單，不需要回收空罐。', 'NO_OLD_JAR_NEEDED', 400);
  }
  if (!order.paidAt) {
    throw new RefillError('尚未付款，不能交付。', 'UNPAID', 409);
  }

  // Fast-path UX checks (authoritative lock is inside the transaction)
  if (order.status === 'old_container_verified') {
    const kind = classifyVerifyOrderConflict({
      status: order.status,
      oldContainerSerial: order.oldContainerSerial,
      attemptedSerial: serial,
    });
    if (kind === 'idempotent_same_serial') {
      return { ok: true as const, serial };
    }
    if (kind === 'conflict_different_serial') {
      throw new RefillError('此訂單已驗收其他空罐序號，不可覆蓋。', 'SERIAL_CONFLICT', 409);
    }
  }
  if (order.status !== 'paid_waiting_return') {
    throw new RefillError('這筆訂單目前不能驗空罐。', 'INVALID_STATUS', 409);
  }

  await prisma.$transaction(async (tx) => {
    const jar = await tx.jarCode.findUnique({ where: { code: serial } });
    if (!jar) throw new RefillError('找不到這個序號。', 'SERIAL_NOT_FOUND', 404);
    if (jar.redeemedByCustomerId !== order.customerId) {
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

    const jarLock = await tx.jarCode.updateMany({
      where: {
        id: jar.id,
        status: 'issued',
        redeemedByCustomerId: order.customerId,
        OR: [{ lockedByRefillOrderId: null }, { lockedByRefillOrderId: order.id }],
      },
      data: { lockedByRefillOrderId: order.id },
    });
    if (interpretClaimCount(jarLock.count) !== 'won') {
      throw new RefillError('這個序號目前無法鎖定，請重試。', 'SERIAL_LOCKED', 409);
    }

    const orderLock = await tx.refillOrder.updateMany({
      where: {
        id: order.id,
        merchantId: input.merchantId,
        status: 'paid_waiting_return',
      },
      data: {
        status: 'old_container_verified',
        oldContainerSerial: serial,
      },
    });

    if (interpretClaimCount(orderLock.count) !== 'won') {
      const fresh = await tx.refillOrder.findUnique({
        where: { id: order.id },
        select: { status: true, oldContainerSerial: true },
      });
      const kind = classifyVerifyOrderConflict({
        status: fresh?.status ?? 'unknown',
        oldContainerSerial: fresh?.oldContainerSerial ?? null,
        attemptedSerial: serial,
      });
      if (kind === 'idempotent_same_serial') {
        return;
      }
      if (kind === 'conflict_different_serial') {
        throw new RefillError('此訂單已驗收其他空罐序號，不可覆蓋。', 'SERIAL_CONFLICT', 409);
      }
      throw new RefillError('這筆訂單目前不能驗空罐。', 'INVALID_STATUS', 409);
    }

    await writeRefillAudit(tx, {
      refillOrderId: order.id,
      action: 'old_container_verified',
      actorType: 'merchant',
      actorId: input.actorId,
      merchantId: input.merchantId,
      serial,
    });
  });

  return { ok: true as const, serial };
}

export async function assignNewAndComplete(input: {
  orderId: string;
  merchantId: string;
  actorId: string;
  newSerialRaw: string;
  /** exchange 路徑若尚未 verify，可一次帶舊罐 */
  oldSerialRaw?: string | null;
}) {
  const newSerial = normalizeJarCode(input.newSerialRaw);
  if (!isValidJarCodeFormat(newSerial)) {
    throw new RefillError('新罐序號須為 8 位數字。', 'INVALID_SERIAL', 400);
  }

  if (input.oldSerialRaw) {
    await verifyOldContainer({
      orderId: input.orderId,
      merchantId: input.merchantId,
      actorId: input.actorId,
      serialRaw: input.oldSerialRaw,
    });
  }

  const order = await loadMerchantOrder(input.orderId, input.merchantId);
  const isFirstPath = isFirstDeliveryPath(order);
  const expectedStatus = expectedCompleteFromStatus(order);

  if (order.status === 'completed') {
    const balance = await getPointsBalance(prisma, order.customerId);
    return {
      ok: true as const,
      status: 'completed' as const,
      pointsAwarded: order.orderType === 'exchange' && !isFirstPath && Boolean(order.pointsAwardedAt),
      pointsBalance: balance,
    };
  }

  if (isFirstPath) {
    if (order.status !== 'paid_waiting_return') {
      throw new RefillError('這筆訂單目前不能交付。', 'INVALID_STATUS', 409);
    }
  } else if (order.status !== 'old_container_verified') {
    throw new RefillError('請先確認收到空罐。', 'NEED_OLD_JAR', 409);
  }

  if (!order.paidAt && order.status !== 'old_container_verified') {
    const paidPayment = await prisma.paymentOrder.findFirst({
      where: { refillOrderId: order.id, status: 'paid' },
    });
    if (!paidPayment) {
      throw new RefillError('尚未付款，不能交付。', 'UNPAID', 409);
    }
  }

  let pointsAwarded = false;
  let wonDeliveryLock = false;

  await prisma.$transaction(async (tx) => {
    const now = new Date();

    const newJar = await tx.jarCode.findUnique({ where: { code: newSerial } });
    if (!newJar) throw new RefillError('找不到新罐序號。', 'SERIAL_NOT_FOUND', 404);
    const canClaim =
      newJar.redeemedByCustomerId == null &&
      (newJar.status === 'unused' || newJar.status === 'issued');
    if (!canClaim) {
      if (newJar.redeemedByCustomerId && newJar.redeemedByCustomerId !== order.customerId) {
        throw new RefillError('這個新罐序號已被其他會員使用。', 'SERIAL_USED', 409);
      }
      throw new RefillError('這個序號已經使用過。', 'SERIAL_USED', 409);
    }

    assertTransition(expectedStatus, 'completed');

    const claim = await tx.refillOrder.updateMany({
      where: {
        id: order.id,
        merchantId: input.merchantId,
        status: expectedStatus,
      },
      data: {
        status: 'completed',
        newContainerSerial: newSerial,
        completedAt: now,
        ...(isFirstPath ? {} : { oldContainerReturnedAt: now }),
      },
    });

    if (interpretClaimCount(claim.count) !== 'won') {
      const fresh = await tx.refillOrder.findUnique({
        where: { id: order.id },
        select: { status: true },
      });
      const kind = classifyCompleteOrderConflict(fresh?.status ?? 'unknown');
      if (kind === 'idempotent_completed') {
        return;
      }
      throw new RefillError('這筆訂單目前不能交付。', 'INVALID_STATUS', 409);
    }

    wonDeliveryLock = true;

    // Reload serials after lock (verify may have set oldContainerSerial)
    const locked = await tx.refillOrder.findUnique({
      where: { id: order.id },
      select: {
        oldContainerSerial: true,
        orderType: true,
        deliveryMode: true,
        pointsAwardedAt: true,
        customerId: true,
      },
    });
    if (!locked) throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);

    if (!isFirstPath && locked.oldContainerSerial) {
      const oldRet = await tx.jarCode.updateMany({
        where: {
          code: locked.oldContainerSerial,
          status: 'issued',
          redeemedByCustomerId: locked.customerId,
        },
        data: {
          status: 'returned',
          returnedAt: now,
          returnedMerchantId: input.merchantId,
          lockedByRefillOrderId: order.id,
        },
      });
      if (interpretClaimCount(oldRet.count) !== 'won') {
        const old = await tx.jarCode.findUnique({
          where: { code: locked.oldContainerSerial },
        });
        const alreadyOurs =
          old?.status === 'returned' && old.lockedByRefillOrderId === order.id;
        if (!alreadyOurs) {
          throw new RefillError('舊罐回收失敗，請重試。', 'OLD_JAR_CONFLICT', 409);
        }
      }
    }

    const newClaim = await tx.jarCode.updateMany({
      where: {
        id: newJar.id,
        redeemedByCustomerId: null,
        status: { in: ['unused', 'issued'] },
      },
      data: {
        status: 'issued',
        redeemedByCustomerId: locked.customerId,
        issuedAt: now,
        issuedMerchantId: input.merchantId,
        lockedByRefillOrderId: null,
      },
    });
    if (interpretClaimCount(newClaim.count) !== 'won') {
      throw new RefillError('這個新罐序號無法領用（可能已被使用）。', 'SERIAL_USED', 409);
    }

    const shouldAward =
      !isFirstPath && locked.orderType === 'exchange' && !locked.pointsAwardedAt;

    if (shouldAward) {
      try {
        await appendPointsLedger(tx, {
          customerId: locked.customerId,
          sourceType: 'refill_completed',
          sourceRefId: order.id,
          pointsChange: 1,
          note: `換罐完成 ${order.id}`,
        });
        pointsAwarded = true;
      } catch (e) {
        if (!isPointsLedgerUniqueConflict(e)) throw e;
        // DB unique：已加過點，不重算 balance
        pointsAwarded = false;
      }

      await tx.refillOrder.update({
        where: { id: order.id },
        data: { pointsAwardedAt: now },
      });
    }

    await writeRefillAudit(tx, {
      refillOrderId: order.id,
      action: 'refill_completed',
      actorType: 'merchant',
      actorId: input.actorId,
      merchantId: input.merchantId,
      serial: newSerial,
      detail: {
        oldSerial: locked.oldContainerSerial,
        pointsAwarded,
        deliveryMode: locked.deliveryMode,
      },
    });
  });

  const done = await prisma.refillOrder.findUnique({
    where: { id: order.id },
    select: { pointsAwardedAt: true, status: true },
  });

  if (done?.status !== 'completed') {
    throw new RefillError('這筆訂單目前不能交付。', 'INVALID_STATUS', 409);
  }

  const hadPoints = Boolean(done.pointsAwardedAt);
  // Notify only when this request won the lock and awarded (or exchange with points flag)
  try {
    await notifyRefillCompleted(
      order.id,
      wonDeliveryLock && pointsAwarded && order.orderType === 'exchange' && !isFirstPath,
    );
  } catch (e) {
    console.error('[refill.complete] notify', e);
  }

  const balance = await getPointsBalance(prisma, order.customerId);
  return {
    ok: true as const,
    status: 'completed' as const,
    pointsAwarded: order.orderType === 'exchange' && !isFirstPath && (pointsAwarded || hadPoints),
    pointsBalance: balance,
  };
}

export async function markMissingContainer(input: {
  orderId: string;
  merchantId: string;
  actorId: string;
  choice: 'keep' | 'topup';
}) {
  const order = await loadMerchantOrder(input.orderId, input.merchantId);
  if (order.status !== 'paid_waiting_return') {
    throw new RefillError('這筆訂單目前不能標記忘帶空罐。', 'INVALID_STATUS', 409);
  }
  if (order.deliveryMode === 'first') {
    throw new RefillError('這筆已是首罐路徑，不需收空罐。', 'NO_OLD_JAR_NEEDED', 400);
  }

  if (input.choice === 'keep') {
    await prisma.$transaction(async (tx) => {
      await tx.refillOrder.update({
        where: { id: order.id },
        data: {
          missingContainerNote: '顧客未帶空罐',
        },
      });
      await writeRefillAudit(tx, {
        refillOrderId: order.id,
        action: 'missing_container_keep',
        actorType: 'merchant',
        actorId: input.actorId,
        merchantId: input.merchantId,
      });
    });
    return { ok: true as const, choice: 'keep' as const, status: order.status };
  }

  // topup
  await prisma.$transaction(async (tx) => {
    assertTransition('paid_waiting_return', 'awaiting_extra_payment');
    await tx.refillOrder.update({
      where: { id: order.id },
      data: {
        status: 'awaiting_extra_payment',
        missingContainerNote: '顧客未帶空罐，改補差額',
      },
    });
    await writeRefillAudit(tx, {
      refillOrderId: order.id,
      action: 'missing_container_topup',
      actorType: 'merchant',
      actorId: input.actorId,
      merchantId: input.merchantId,
    });
  });

  // Create payment checkout for customer (store shows QR / link)
  const payment = await initiateRefillPayment({
    orderId: order.id,
    customerId: order.customerId,
    purpose: 'extra_topup',
  });

  return {
    ok: true as const,
    choice: 'topup' as const,
    status: 'awaiting_extra_payment' as const,
    payment,
  };
}
