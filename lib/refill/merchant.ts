import { prisma } from '@/lib/prisma';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';
import { appendPointsLedger, getPointsBalance } from '@/lib/jar-exchange/points';
import { formatFlavourLabel } from '@/lib/jar-exchange/refill-plan-content';
import { assertTransition } from '@/lib/refill/transitions';
import { RefillError } from '@/lib/refill/errors';
import { writeRefillAudit } from '@/lib/refill/audit';
import { notifyRefillCompleted } from '@/lib/refill/notify';
import {
  REFILL_PAID_OPEN_STATUSES,
  type RefillOrderStatus,
} from '@/lib/refill/constants';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { initiateRefillPayment } from '@/lib/refill/payment';
import {
  decrementFlavourStockInTxn,
  listMerchantFulfilmentStock,
  resolveStoreIdForMerchant,
} from '@/lib/refill/store-stock';

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
      preferredFlavour: { select: { name: true, weightGrams: true } },
      fulfilledFlavour: { select: { name: true, weightGrams: true } },
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
    preferredFlavourLabel: o.preferredFlavour
      ? formatFlavourLabel(o.preferredFlavour.name, o.preferredFlavour.weightGrams)
      : null,
    fulfilledFlavourLabel: o.fulfilledFlavour
      ? formatFlavourLabel(o.fulfilledFlavour.name, o.fulfilledFlavour.weightGrams)
      : null,
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
      preferredFlavour: { select: { id: true, name: true, weightGrams: true } },
      fulfilledFlavour: { select: { id: true, name: true, weightGrams: true } },
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

export async function getMerchantRefillOrderDetail(orderId: string, merchantId: string) {
  const order = await loadMerchantOrder(orderId, merchantId);
  const stock = await listMerchantFulfilmentStock(prisma, merchantId);
  return {
    order: {
      id: order.id,
      status: order.status,
      orderType: order.orderType,
      deliveryMode: order.deliveryMode,
      totalAmount: order.totalAmount,
      paidAt: order.paidAt?.toISOString() ?? null,
      preferredFlavourId: order.preferredFlavourId,
      preferredFlavourLabel: order.preferredFlavour
        ? formatFlavourLabel(order.preferredFlavour.name, order.preferredFlavour.weightGrams)
        : null,
      fulfilledFlavourId: order.fulfilledFlavourId,
      fulfilledFlavourLabel: order.fulfilledFlavour
        ? formatFlavourLabel(order.fulfilledFlavour.name, order.fulfilledFlavour.weightGrams)
        : null,
      oldContainerSerial: order.oldContainerSerial,
      newContainerSerial: order.newContainerSerial,
      missingContainerNote: order.missingContainerNote,
      completedAt: order.completedAt?.toISOString() ?? null,
    },
    stock,
  };
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

  if (!['paid_waiting_return'].includes(order.status)) {
    throw new RefillError('這筆訂單目前不能驗空罐。', 'INVALID_STATUS', 409);
  }
  if (order.deliveryMode === 'first') {
    throw new RefillError('這筆是首罐／補差額訂單，不需要回收空罐。', 'NO_OLD_JAR_NEEDED', 400);
  }
  if (!order.paidAt) {
    throw new RefillError('尚未付款，不能交付。', 'UNPAID', 409);
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

    await tx.jarCode.update({
      where: { id: jar.id },
      data: { lockedByRefillOrderId: order.id },
    });

    await tx.refillOrder.update({
      where: { id: order.id },
      data: {
        status: 'old_container_verified',
        oldContainerSerial: serial,
      },
    });

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
  /** 實際交付口味（必填）；不可用 preferred 自動帶入 */
  fulfilledFlavourId: string;
  /** exchange 路徑若尚未 verify，可一次帶舊罐 */
  oldSerialRaw?: string | null;
}) {
  const newSerial = normalizeJarCode(input.newSerialRaw);
  if (!isValidJarCodeFormat(newSerial)) {
    throw new RefillError('新罐序號須為 8 位數字。', 'INVALID_SERIAL', 400);
  }
  if (!input.fulfilledFlavourId?.trim()) {
    throw new RefillError('請選擇實際交付口味。', 'FLAVOUR_REQUIRED', 400);
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

  const isFirstPath = order.deliveryMode === 'first' || order.orderType === 'first';
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

  // 禁止用其他店庫存：僅解析本 merchant 對應 Store
  const storeId = await resolveStoreIdForMerchant(prisma, input.merchantId);

  const flavour = await prisma.refillFlavour.findFirst({
    where: { id: input.fulfilledFlavourId, isActive: true },
    select: { id: true, name: true, weightGrams: true },
  });
  if (!flavour) {
    throw new RefillError('找不到這個口味。', 'FLAVOUR_NOT_FOUND', 400);
  }

  let pointsAwarded = false;
  let alreadyCompleted = false;

  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.refillOrder.findUnique({ where: { id: order.id } });
      if (!fresh) throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);
      if (fresh.status === 'completed') {
        alreadyCompleted = true;
        return;
      }

      const expectedStatus = isFirstPath ? 'paid_waiting_return' : 'old_container_verified';
      assertTransition(expectedStatus as RefillOrderStatus, 'completed');
      const now = new Date();

      // 原子佔用 completedAt，防止雙店員同時交付
      const claimed = await tx.refillOrder.updateMany({
        where: {
          id: fresh.id,
          status: expectedStatus,
          completedAt: null,
        },
        data: { completedAt: now },
      });
      if (claimed.count === 0) {
        const again = await tx.refillOrder.findUnique({ where: { id: fresh.id } });
        if (again?.status === 'completed') {
          alreadyCompleted = true;
          return;
        }
        throw new RefillError('這筆訂單目前不能交付，或已由其他人完成。', 'INVALID_STATUS', 409);
      }

      const newJar = await tx.jarCode.findUnique({ where: { code: newSerial } });
      if (!newJar) throw new RefillError('找不到新罐序號。', 'SERIAL_NOT_FOUND', 404);
      if (newJar.status !== 'unused' && !(newJar.status === 'issued' && !newJar.redeemedByCustomerId)) {
        if (newJar.redeemedByCustomerId && newJar.redeemedByCustomerId !== fresh.customerId) {
          throw new RefillError('這個新罐序號已被其他會員使用。', 'SERIAL_USED', 409);
        }
        if (newJar.status === 'issued' || newJar.status === 'returned' || newJar.status === 'used') {
          throw new RefillError('這個序號已經使用過。', 'SERIAL_USED', 409);
        }
      }

      if (!isFirstPath && fresh.oldContainerSerial) {
        const old = await tx.jarCode.findUnique({
          where: { code: fresh.oldContainerSerial },
        });
        if (!old || old.redeemedByCustomerId !== fresh.customerId) {
          throw new RefillError('舊罐序號驗證失敗。', 'SERIAL_NOT_OWNED', 409);
        }
        if (old.status === 'issued') {
          await tx.jarCode.update({
            where: { id: old.id },
            data: {
              status: 'returned',
              returnedAt: now,
              returnedMerchantId: input.merchantId,
              lockedByRefillOrderId: fresh.id,
            },
          });
        } else if (old.status !== 'returned' || old.lockedByRefillOrderId !== fresh.id) {
          throw new RefillError('這個序號已經使用過。', 'SERIAL_USED', 409);
        }
      }

      await decrementFlavourStockInTxn(tx, {
        storeId,
        flavourId: flavour.id,
        actorUserId: input.actorId,
        refillOrderId: fresh.id,
        note: `fulfill:${fresh.id}`,
      });

      await tx.jarCode.update({
        where: { id: newJar.id },
        data: {
          status: 'issued',
          redeemedByCustomerId: fresh.customerId,
          issuedAt: now,
          issuedMerchantId: input.merchantId,
          lockedByRefillOrderId: null,
        },
      });

      const shouldAward =
        !isFirstPath && fresh.orderType === 'exchange' && !fresh.pointsAwardedAt;

      if (shouldAward) {
        const existing = await tx.memberPointsLedger.findFirst({
          where: {
            sourceType: 'refill_completed',
            sourceRefId: fresh.id,
          },
        });
        if (!existing) {
          await appendPointsLedger(tx, {
            customerId: fresh.customerId,
            sourceType: 'refill_completed',
            sourceRefId: fresh.id,
            pointsChange: 1,
            note: `換罐完成 ${fresh.id}`,
          });
          pointsAwarded = true;
        }
      }

      // 寫入實際口味；絕不覆蓋 preferredFlavourId
      await tx.refillOrder.update({
        where: { id: fresh.id },
        data: {
          status: 'completed',
          newContainerSerial: newSerial,
          fulfilledFlavourId: flavour.id,
          fulfilledByUserId: input.actorId,
          completedAt: now,
          oldContainerReturnedAt: !isFirstPath ? now : fresh.oldContainerReturnedAt,
          pointsAwardedAt: pointsAwarded || fresh.pointsAwardedAt ? now : fresh.pointsAwardedAt,
        },
      });

      await writeRefillAudit(tx, {
        refillOrderId: fresh.id,
        action: 'refill_completed',
        actorType: 'merchant',
        actorId: input.actorId,
        merchantId: input.merchantId,
        serial: newSerial,
        detail: {
          oldSerial: fresh.oldContainerSerial,
          preferredFlavourId: fresh.preferredFlavourId,
          fulfilledFlavourId: flavour.id,
          storeId,
          pointsAwarded,
          deliveryMode: fresh.deliveryMode,
        },
      });
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2002') {
      throw new RefillError('這個序號已經使用過。', 'SERIAL_USED', 409);
    }
    throw e;
  }

  if (alreadyCompleted) {
    const balance = await getPointsBalance(prisma, order.customerId);
    return {
      ok: true as const,
      status: 'completed' as const,
      pointsAwarded: false,
      pointsBalance: balance,
      reused: true as const,
    };
  }

  const done = await prisma.refillOrder.findUnique({
    where: { id: order.id },
    select: { pointsAwardedAt: true, status: true },
  });
  pointsAwarded = Boolean(done?.pointsAwardedAt);

  try {
    await notifyRefillCompleted(order.id, pointsAwarded && order.orderType === 'exchange' && !isFirstPath);
  } catch (e) {
    console.error('[refill.complete] notify', e);
  }

  const balance = await getPointsBalance(prisma, order.customerId);
  return {
    ok: true as const,
    status: 'completed' as const,
    pointsAwarded: order.orderType === 'exchange' && !isFirstPath && pointsAwarded,
    pointsBalance: balance,
    fulfilledFlavourId: flavour.id,
    fulfilledFlavourLabel: formatFlavourLabel(flavour.name, flavour.weightGrams),
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
