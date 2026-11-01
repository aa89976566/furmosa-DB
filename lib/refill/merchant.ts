import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';
import { appendPointsLedger, getPointsBalance } from '@/lib/jar-exchange/points';
import { assertTransition } from '@/lib/refill/transitions';
import { RefillError } from '@/lib/refill/errors';
import { writeRefillAudit } from '@/lib/refill/audit';
import {
  enqueueRefillCompletedNotification,
  safelyEnqueueAndAttempt,
} from '@/lib/automation/line-jobs';
import {
  REFILL_PAID_OPEN_STATUSES,
  refillDeliveryRequiresEmptyJar,
  type RefillOrderStatus,
} from '@/lib/refill/constants';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { initiateRefillPayment } from '@/lib/refill/payment';
import { resolveCouponStoreForMerchant } from '@/lib/coupons/merchant-store-access';

export type MerchantJarExchangeMember = {
  id: string;
  customerId: string;
  name: string;
  petName: string | null;
  serviceStatus: string;
  lastExchangeAt: string | null;
};

/**
 * 店家端的換罐會員名單。
 *
 * 可見性只有單一來源：這位顧客目前在本店有至少一筆 status='completed' 的
 * RefillOrder。開戶店家（signupStore／storeId／storeName）、僅建立但未完成的
 * 訂單、以及在他店完成的紀錄都不算數，所以店家看不到跨店活動。
 *
 * 名單也不回傳全平台點數餘額，避免由點數推算其他店家的換罐次數。
 */
export async function listMerchantJarExchangeMembers(
  merchantRecordId: string,
): Promise<MerchantJarExchangeMember[]> {
  // 沒有可辨識的店家時一律關閉，不可退回成全平台查詢。
  if (!merchantRecordId) return [];

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantRecordId },
    select: { id: true },
  });
  if (!merchant) return [];

  const customers = await prisma.customer.findMany({
    where: {
      services: {
        some: {
          serviceType: 'jar_exchange',
          serviceStatus: { in: ['active', 'paused'] },
        },
      },
      refillOrders: {
        some: { merchantId: merchant.id, status: 'completed' },
      },
    },
    select: {
      id: true,
      customerId: true,
      name: true,
      petName: true,
      services: {
        where: { serviceType: 'jar_exchange' },
        select: { serviceStatus: true },
        take: 1,
      },
      refillOrders: {
        where: { merchantId: merchant.id, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  return customers.map((customer) => ({
    id: customer.id,
    customerId: customer.customerId,
    name: customer.name,
    petName: customer.petName,
    serviceStatus: customer.services[0]?.serviceStatus ?? 'paused',
    lastExchangeAt: customer.refillOrders[0]?.completedAt?.toISOString() ?? null,
  }));
}

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
      deliveredFlavour: { select: { name: true, weightGrams: true } },
    },
  });

  return rows.map((o) => ({
    id: o.id,
    status: o.status,
    orderType: o.orderType,
    deliveryMode: o.deliveryMode,
    totalAmount: o.totalAmount,
    extraAmount: o.extraAmount,
    petName: o.petName ?? o.appointment.petName,
    customerName: o.customer.name,
    date: formatLocalDate(o.appointment.startsAt),
    time: formatLocalTime(o.appointment.startsAt),
    startsAt: o.appointment.startsAt.toISOString(),
    createdAt: o.createdAt.toISOString(),
    paid: Boolean(o.paidAt) || o.payments.length > 0,
    oldContainerSerial: o.oldContainerSerial,
    newContainerSerial: o.newContainerSerial,
    missingContainerNote: o.missingContainerNote,
    oldContainerReturnedAt: o.oldContainerReturnedAt?.toISOString() ?? null,
    productLabel:
      o.deliveredFlavour
        ? `${o.deliveredFlavour.name} ${o.deliveredFlavour.weightGrams}g`
        : o.deliveryMode === 'first' || o.orderType === 'first'
          ? '首罐（到店選口味）'
          : '續罐（到店選口味）',
    deliveredQuantity: o.deliveredQuantity,
  }));
}

type CompleteDeliveryTxResult = {
  outcome: 'COMPLETED' | 'ALREADY_COMPLETED';
  orderId: string;
};

/**
 * 新版到店交付：店員只確認空罐與實際交付品項，不碰 8 位序號。
 * 扣庫存、寫異動、完成訂單與稽核在同一個交易內，重送不會重複扣庫存。
 */
export async function completeRefillDelivery(input: {
  orderId: string;
  merchantId: string;
  actorId: string;
  flavourId: string;
  quantity: number;
  emptyJarConfirmed: boolean;
}) {
  const quantity = Math.trunc(input.quantity);
  if (!input.flavourId || quantity < 1 || quantity > 20) {
    throw new RefillError('請選擇實際交付品項與正確數量。', 'INVALID_DELIVERY', 400);
  }

  const storeAccess = await resolveCouponStoreForMerchant(input.merchantId);
  if (!storeAccess) {
    throw new RefillError('本店尚未完成換罐庫存設定。', 'STORE_NOT_READY', 409);
  }
  const store = await prisma.store.findUnique({
    where: { slug: storeAccess.storeSlug },
    select: { id: true },
  });
  if (!store) {
    throw new RefillError('本店尚未完成換罐庫存設定。', 'STORE_NOT_READY', 409);
  }

  const result: CompleteDeliveryTxResult = await prisma.$transaction(async (tx) => {
    await lockRefillOrderForCompletion(tx, input.orderId, input.merchantId);
    const order = await tx.refillOrder.findUnique({ where: { id: input.orderId } });
    if (!order) throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);

    if (order.status === 'completed') {
      if (
        order.deliveredFlavourId === input.flavourId &&
        order.deliveredQuantity === quantity
      ) {
        return { outcome: 'ALREADY_COMPLETED', orderId: order.id };
      }
      throw new RefillError('這筆訂單已完成，不能再次交付。', 'ALREADY_COMPLETED', 409);
    }
    if (!['paid_waiting_return', 'old_container_verified'].includes(order.status)) {
      throw new RefillError('這筆訂單目前不能交付。', 'INVALID_STATUS', 409);
    }

    const paid = order.paidAt
      ? true
      : Boolean(await tx.paymentOrder.findFirst({
          where: { refillOrderId: order.id, status: 'paid' },
          select: { id: true },
        }));
    if (!paid) throw new RefillError('尚未付款，不能交付。', 'UNPAID', 409);

    const needsEmptyJar = refillDeliveryRequiresEmptyJar(order);
    const isFirstPath = !needsEmptyJar;
    if (needsEmptyJar && !input.emptyJarConfirmed) {
      throw new RefillError('續罐需先確認已收到實體空罐。', 'NEED_EMPTY_JAR', 409);
    }

    const lockedStocks = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "merchant_refill_stocks"
      WHERE "store_id" = ${store.id}
        AND "flavour_id" = ${input.flavourId}
      FOR UPDATE
    `;
    if (lockedStocks.length !== 1) {
      throw new RefillError('本店沒有這個可換品項。', 'STOCK_NOT_FOUND', 409);
    }
    const stock = await tx.merchantRefillStock.findUnique({
      where: { storeId_flavourId: { storeId: store.id, flavourId: input.flavourId } },
      include: { flavour: { select: { name: true, weightGrams: true, isActive: true } } },
    });
    if (!stock || !stock.isAvailable || !stock.flavour.isActive || stock.quantity < quantity) {
      throw new RefillError('本店此品項庫存不足，請選擇其他品項。', 'INSUFFICIENT_STOCK', 409);
    }

    const deducted = await tx.merchantRefillStock.updateMany({
      where: {
        id: stock.id,
        quantity: { gte: quantity },
        isAvailable: true,
      },
      data: {
        quantity: { decrement: quantity },
        updatedByUserId: input.actorId,
      },
    });
    if (deducted.count !== 1) {
      throw new RefillError('本店此品項庫存不足，請重新整理。', 'INSUFFICIENT_STOCK', 409);
    }
    const quantityAfter = stock.quantity - quantity;
    await tx.refillStockTxn.create({
      data: {
        storeId: store.id,
        flavourId: stock.flavourId,
        changeQty: -quantity,
        quantityAfter,
        reason: 'refill_delivery',
        note: `換罐交付 ${order.id}`,
        createdByUserId: input.actorId,
      },
    });

    assertTransition(order.status as RefillOrderStatus, 'completed');
    const now = new Date();
    const completed = await tx.refillOrder.updateMany({
      where: { id: order.id, merchantId: input.merchantId, status: order.status },
      data: {
        status: 'completed',
        completedAt: now,
        oldContainerReturnedAt: !isFirstPath ? now : order.oldContainerReturnedAt,
        deliveredFlavourId: stock.flavourId,
        deliveredQuantity: quantity,
      },
    });
    if (completed.count !== 1) {
      throw new RefillError('這筆訂單已由其他裝置處理。', 'ALREADY_COMPLETED', 409);
    }

    await writeRefillAudit(tx, {
      refillOrderId: order.id,
      action: 'refill_delivered',
      actorType: 'merchant',
      actorId: input.actorId,
      merchantId: input.merchantId,
      detail: {
        flavourId: stock.flavourId,
        flavourName: stock.flavour.name,
        weightGrams: stock.flavour.weightGrams,
        quantity,
        quantityAfter,
        emptyJarConfirmed: !isFirstPath,
        orderType: order.orderType,
        totalAmount: order.totalAmount,
      },
    });
    return { outcome: 'COMPLETED', orderId: order.id };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (result.outcome === 'COMPLETED') {
    await safelyEnqueueAndAttempt(() =>
      enqueueRefillCompletedNotification(result.orderId, false),
    );
  }
  return { ok: true as const, status: 'completed' as const, repeated: result.outcome === 'ALREADY_COMPLETED' };
}

const LOOKUP_STATUSES = [...REFILL_PAID_OPEN_STATUSES, 'payment_pending'] as const;

export async function lookupRefillBySerial(merchantId: string, serialRaw: string) {
  const serial = normalizeJarCode(serialRaw);
  if (!isValidJarCodeFormat(serial)) {
    throw new RefillError('找不到這個罐子的換罐資料', 'INVALID_SERIAL', 400);
  }

  const jar = await prisma.jarCode.findUnique({
    where: { code: serial },
    select: {
      code: true,
      status: true,
      redeemedByCustomerId: true,
      lockedByRefillOrderId: true,
    },
  });
  if (!jar) {
    throw new RefillError('找不到這個罐子的換罐資料', 'SERIAL_NOT_FOUND', 404);
  }

  const selectOrder = {
    id: true,
    status: true,
    deliveryMode: true,
    paidAt: true,
    oldContainerSerial: true,
    newContainerSerial: true,
    missingContainerNote: true,
    extraAmount: true,
    orderType: true,
    customer: { select: { name: true } },
    petName: true,
  };

  if (jar.lockedByRefillOrderId) {
    const locked = await prisma.refillOrder.findUnique({
      where: { id: jar.lockedByRefillOrderId },
      select: { ...selectOrder, merchantId: true },
    });
    if (locked && locked.merchantId !== merchantId) {
      throw new RefillError('這筆換罐不是在本店領取', 'WRONG_STORE', 403);
    }
  }

  let order =
    jar.lockedByRefillOrderId != null
      ? await prisma.refillOrder.findFirst({
          where: { id: jar.lockedByRefillOrderId, merchantId },
          select: selectOrder,
        })
      : null;

  if (!order && jar.redeemedByCustomerId) {
    order = await prisma.refillOrder.findFirst({
      where: {
        merchantId,
        customerId: jar.redeemedByCustomerId,
        status: { in: [...LOOKUP_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      select: selectOrder,
    });
  }

  if (!order && jar.redeemedByCustomerId) {
    const elsewhere = await prisma.refillOrder.findFirst({
      where: {
        customerId: jar.redeemedByCustomerId,
        status: { in: [...LOOKUP_STATUSES] },
        merchantId: { not: merchantId },
      },
      select: { id: true },
    });
    if (elsewhere) {
      throw new RefillError('這筆換罐不是在本店領取', 'WRONG_STORE', 403);
    }
  }

  if (!order) {
    throw new RefillError('找不到這個罐子的換罐資料', 'NO_OPEN_ORDER', 404);
  }

  return {
    orderId: order.id,
    serial,
    status: order.status,
    customerName: order.customer.name,
    petName: order.petName,
    paid: Boolean(order.paidAt),
    oldContainerSerial: order.oldContainerSerial,
    newContainerSerial: order.newContainerSerial,
    missingContainerNote: order.missingContainerNote,
    deliveryMode: order.deliveryMode,
  };
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
    throw new RefillError('這筆換罐不是在本店領取', 'WRONG_STORE', 403);
  }
  return order;
}

export async function lookupRefillByOrderId(merchantId: string, orderIdRaw: string) {
  const orderId = orderIdRaw.trim();
  if (!orderId) {
    throw new RefillError('找不到這個罐子的換罐資料', 'ORDER_NOT_FOUND', 404);
  }

  const found = await prisma.refillOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      merchantId: true,
      status: true,
      deliveryMode: true,
      paidAt: true,
      oldContainerSerial: true,
      newContainerSerial: true,
      missingContainerNote: true,
      extraAmount: true,
      orderType: true,
      customer: { select: { name: true } },
      petName: true,
    },
  });

  if (!found) {
    throw new RefillError('找不到這個罐子的換罐資料', 'ORDER_NOT_FOUND', 404);
  }
  if (found.merchantId !== merchantId) {
    throw new RefillError('這筆換罐不是在本店領取', 'WRONG_STORE', 403);
  }

  return {
    orderId: found.id,
    serial: found.oldContainerSerial ?? '',
    status: found.status,
    customerName: found.customer.name,
    petName: found.petName,
    paid: Boolean(found.paidAt),
    oldContainerSerial: found.oldContainerSerial,
    newContainerSerial: found.newContainerSerial,
    missingContainerNote: found.missingContainerNote,
    deliveryMode: found.deliveryMode,
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

type AssignNewCompletionTxResult = {
  outcome: 'COMPLETED' | 'ALREADY_COMPLETED';
  orderId: string;
  customerId: string;
  pointsAwarded: boolean;
};

function deliveredPointsAwarded(order: {
  orderType: string;
  deliveryMode: string;
  pointsAwardedAt: Date | null;
}): boolean {
  const isFirstPath = order.deliveryMode === 'first' || order.orderType === 'first';
  return order.orderType === 'exchange' && !isFirstPath && order.pointsAwardedAt != null;
}

async function lockRefillOrderForCompletion(
  tx: Prisma.TransactionClient,
  orderId: string,
  merchantId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "refill_orders"
    WHERE "id" = ${orderId}
      AND "merchant_id" = ${merchantId}
    FOR UPDATE
  `;
  if (rows.length !== 1) {
    throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);
  }
}

async function lockJarCodesForCompletion(
  tx: Prisma.TransactionClient,
  codes: readonly string[],
): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "jar_codes"
    WHERE "code" IN (${Prisma.join(codes)})
    ORDER BY "id"
    FOR UPDATE
  `;
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

  // 交易外只確認這筆訂單存在且屬於本店。完成、重送與衝突都等鎖後資料。
  await loadMerchantOrder(input.orderId, input.merchantId);

  const result: AssignNewCompletionTxResult = await prisma.$transaction(async (tx) => {
    await lockRefillOrderForCompletion(tx, input.orderId, input.merchantId);
    const fresh = await tx.refillOrder.findUnique({ where: { id: input.orderId } });
    if (!fresh) throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);
    if (fresh.merchantId !== input.merchantId) {
      throw new RefillError('這筆換罐不是在本店領取', 'WRONG_STORE', 403);
    }
    if (!fresh.customerId) {
      throw new RefillError('找不到訂單。', 'ORDER_NOT_FOUND', 404);
    }

    if (fresh.status === 'completed') {
      const sameCanister =
        fresh.newContainerSerial != null &&
        fresh.newContainerSerial !== '' &&
        normalizeJarCode(fresh.newContainerSerial) === newSerial;
      if (!sameCanister) {
        throw new RefillError(
          '這筆訂單已用其他新罐完成。',
          'COMPLETED_WITH_DIFFERENT_CANISTER',
          409,
        );
      }
      return {
        outcome: 'ALREADY_COMPLETED',
        orderId: fresh.id,
        customerId: fresh.customerId,
        pointsAwarded: deliveredPointsAwarded(fresh),
      };
    }

    const isFirstPath = fresh.deliveryMode === 'first' || fresh.orderType === 'first';
    if (isFirstPath) {
      if (fresh.status !== 'paid_waiting_return') {
        throw new RefillError('這筆訂單目前不能交付。', 'INVALID_STATUS', 409);
      }
    } else if (fresh.status !== 'old_container_verified') {
      throw new RefillError('請先確認收到空罐。', 'NEED_OLD_JAR', 409);
    }

    if (!fresh.paidAt && fresh.status !== 'old_container_verified') {
      const paidPayment = await tx.paymentOrder.findFirst({
        where: { refillOrderId: fresh.id, status: 'paid' },
      });
      if (!paidPayment) {
        throw new RefillError('尚未付款，不能交付。', 'UNPAID', 409);
      }
    }

    const from = fresh.status as RefillOrderStatus;
    assertTransition(from, 'completed');

    if (
      fresh.oldContainerSerial &&
      normalizeJarCode(fresh.oldContainerSerial) === newSerial
    ) {
      throw new RefillError('新罐序號不可與舊罐相同。', 'INVALID_SERIAL', 400);
    }

    const jarCodes = [newSerial];
    if (!isFirstPath && fresh.oldContainerSerial) {
      jarCodes.push(fresh.oldContainerSerial);
    }
    await lockJarCodesForCompletion(tx, jarCodes);

    const now = new Date();

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
      if (old.status === 'returned') {
        if (old.lockedByRefillOrderId !== fresh.id) {
          throw new RefillError('舊罐序號驗證失敗。', 'SERIAL_NOT_OWNED', 409);
        }
      } else if (old.status === 'issued') {
        const returned = await tx.jarCode.updateMany({
          where: {
            id: old.id,
            redeemedByCustomerId: fresh.customerId,
            status: 'issued',
          },
          data: {
            status: 'returned',
            returnedAt: now,
            returnedMerchantId: input.merchantId,
            lockedByRefillOrderId: fresh.id,
          },
        });
        if (returned.count !== 1) {
          throw new RefillError('舊罐序號驗證失敗。', 'SERIAL_NOT_OWNED', 409);
        }
      } else {
        throw new RefillError('舊罐序號驗證失敗。', 'SERIAL_NOT_OWNED', 409);
      }
    }

    const issued = await tx.jarCode.updateMany({
      where: {
        id: newJar.id,
        OR: [
          { status: 'unused' },
          { status: 'issued', redeemedByCustomerId: null },
        ],
      },
      data: {
        status: 'issued',
        redeemedByCustomerId: fresh.customerId,
        issuedAt: now,
        issuedMerchantId: input.merchantId,
        lockedByRefillOrderId: null,
      },
    });
    if (issued.count !== 1) {
      throw new RefillError('這個序號已經使用過。', 'SERIAL_USED', 409);
    }

    // Points: only exchange delivery (not first / topup-as-first)
    let pointsAwarded = false;
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

    const pointsAwardedAt =
      pointsAwarded || fresh.pointsAwardedAt ? now : fresh.pointsAwardedAt;

    const completed = await tx.refillOrder.updateMany({
      where: {
        id: fresh.id,
        merchantId: input.merchantId,
        status: fresh.status,
      },
      data: {
        status: 'completed',
        newContainerSerial: newSerial,
        completedAt: now,
        oldContainerReturnedAt: !isFirstPath ? now : fresh.oldContainerReturnedAt,
        pointsAwardedAt,
      },
    });
    if (completed.count !== 1) {
      throw new RefillError('這筆訂單目前不能交付。', 'INVALID_STATUS', 409);
    }

    await writeRefillAudit(tx, {
      refillOrderId: fresh.id,
      action: 'refill_completed',
      actorType: 'merchant',
      actorId: input.actorId,
      merchantId: input.merchantId,
      serial: newSerial,
      detail: {
        oldSerial: fresh.oldContainerSerial,
        pointsAwarded,
        deliveryMode: fresh.deliveryMode,
      },
    });

    return {
      outcome: 'COMPLETED',
      orderId: fresh.id,
      customerId: fresh.customerId,
      pointsAwarded: deliveredPointsAwarded({
        orderType: fresh.orderType,
        deliveryMode: fresh.deliveryMode,
        pointsAwardedAt,
      }),
    };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (result.outcome === 'COMPLETED') {
    await safelyEnqueueAndAttempt(() =>
      enqueueRefillCompletedNotification(result.orderId, result.pointsAwarded),
    );
  }

  const balance = await getPointsBalance(prisma, result.customerId);
  return {
    ok: true as const,
    status: 'completed' as const,
    pointsAwarded: result.pointsAwarded,
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
