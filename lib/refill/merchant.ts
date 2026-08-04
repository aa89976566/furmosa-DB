import { prisma } from '@/lib/prisma';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';
import { getPointsBalance } from '@/lib/jar-exchange/points';
import { formatFlavourLabel } from '@/lib/jar-exchange/refill-plan-content';
import { assertTransition } from '@/lib/refill/transitions';
import { RefillError } from '@/lib/refill/errors';
import { writeRefillAudit } from '@/lib/refill/audit';
import { notifyRefillCompleted } from '@/lib/refill/notify';
import { REFILL_PAID_OPEN_STATUSES } from '@/lib/refill/constants';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { initiateRefillPayment } from '@/lib/refill/payment';
import {
  listMerchantFulfilmentStock,
  resolveStoreIdForMerchant,
} from '@/lib/refill/store-stock';
import {
  completeRefillInTxn,
  verifyOldContainerInTxn,
} from '@/lib/refill/complete-txn';

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

/** 兩段式：先驗舊罐（獨立 txn；允許稍後再交付） */
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
    await verifyOldContainerInTxn(tx, {
      orderId: order.id,
      customerId: order.customerId,
      merchantId: input.merchantId,
      actorId: input.actorId,
      serial,
    });
  });

  return { ok: true as const, serial };
}

/**
 * 交付完成。
 * - 兩段式：status 已是 old_container_verified，不帶 oldSerialRaw
 * - one-shot：status 為 paid_waiting_return，帶 oldSerialRaw；
 *   舊罐驗證／lock／returned／扣庫存／綁新罐／completed 全在同一 transaction
 */
export async function assignNewAndComplete(input: {
  orderId: string;
  merchantId: string;
  actorId: string;
  newSerialRaw: string;
  fulfilledFlavourId: string;
  oldSerialRaw?: string | null;
}) {
  const newSerial = normalizeJarCode(input.newSerialRaw);
  if (!isValidJarCodeFormat(newSerial)) {
    throw new RefillError('新罐序號須為 8 位數字。', 'INVALID_SERIAL', 400);
  }
  if (!input.fulfilledFlavourId?.trim()) {
    throw new RefillError('請選擇實際交付口味。', 'FLAVOUR_REQUIRED', 400);
  }

  const order = await loadMerchantOrder(input.orderId, input.merchantId);
  const isFirstPath = order.deliveryMode === 'first' || order.orderType === 'first';
  const hasOneShotOld = Boolean(input.oldSerialRaw?.trim());

  if (isFirstPath) {
    if (order.status !== 'paid_waiting_return') {
      throw new RefillError('這筆訂單目前不能交付。', 'INVALID_STATUS', 409);
    }
  } else if (order.status === 'paid_waiting_return') {
    if (!hasOneShotOld) {
      throw new RefillError('請先確認收到空罐。', 'NEED_OLD_JAR', 409);
    }
  } else if (order.status !== 'old_container_verified') {
    throw new RefillError('這筆訂單目前不能交付。', 'INVALID_STATUS', 409);
  }

  if (!order.paidAt && order.status !== 'old_container_verified') {
    const paidPayment = await prisma.paymentOrder.findFirst({
      where: { refillOrderId: order.id, status: 'paid' },
    });
    if (!paidPayment) {
      throw new RefillError('尚未付款，不能交付。', 'UNPAID', 409);
    }
  }

  const storeId = await resolveStoreIdForMerchant(prisma, input.merchantId);

  const flavour = await prisma.refillFlavour.findFirst({
    where: { id: input.fulfilledFlavourId, isActive: true },
    select: { id: true, name: true, weightGrams: true },
  });
  if (!flavour) {
    throw new RefillError('找不到這個口味。', 'FLAVOUR_NOT_FOUND', 400);
  }

  let result: Awaited<ReturnType<typeof completeRefillInTxn>>;

  try {
    result = await prisma.$transaction(async (tx) => {
      // 不得在此呼叫會自行另開 transaction 的函式
      return completeRefillInTxn(tx, {
        orderId: order.id,
        merchantId: input.merchantId,
        actorId: input.actorId,
        storeId,
        fulfilledFlavourId: flavour.id,
        newSerial,
        oldSerialRaw: hasOneShotOld ? input.oldSerialRaw : null,
      });
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2002') {
      throw new RefillError('這個序號已經使用過。', 'SERIAL_USED', 409);
    }
    throw e;
  }

  if (result.alreadyCompleted) {
    const balance = await getPointsBalance(prisma, order.customerId);
    return {
      ok: true as const,
      status: 'completed' as const,
      pointsAwarded: false,
      pointsBalance: balance,
      reused: true as const,
    };
  }

  const pointsAwarded = result.pointsAwarded;
  try {
    await notifyRefillCompleted(
      order.id,
      pointsAwarded && order.orderType === 'exchange' && !isFirstPath,
    );
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
