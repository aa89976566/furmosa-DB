import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  REFILL_ACTIVE_STATUSES,
  REFILL_PAID_OPEN_STATUSES,
  amountsForOrderType,
  type RefillOrderType,
} from '@/lib/refill/constants';
import { isBookableForRefill } from '@/lib/refill/eligibility';
import { RefillError } from '@/lib/refill/errors';
import { writeRefillAudit } from '@/lib/refill/audit';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';

/**
 * Count jar ownership evidence for refill pricing.
 *
 * LINE serial registration is the customer-facing source of truth and stores a
 * claimed 8-digit serial as status='used'. The older delivery flow stored the
 * jar currently held by the customer as status='issued'. Both prove that this
 * is not the customer's first jar. Do not require an unlocked refill order
 * here: a pending order must not make an existing customer fall back to the
 * NT$129 first-jar price on refresh.
 */
export function refillJarOwnershipWhere(customerId: string): Prisma.JarCodeWhereInput {
  return {
    redeemedByCustomerId: customerId,
    status: { in: ['used', 'issued'] },
  };
}

/** A jar can fund exactly one new exchange order at a time. */
export function refillJarReservationWhere(
  customerId: string,
): Prisma.JarCodeWhereInput {
  return {
    redeemedByCustomerId: customerId,
    status: { in: ['used', 'issued'] },
    lockedByRefillOrderId: null,
  };
}

async function reserveAvailableJar(
  tx: Prisma.TransactionClient,
  input: { customerId: string; refillOrderId: string },
) {
  // A concurrent order may win the first candidate between findFirst and
  // updateMany. Retry a small bounded number of times so another unlocked jar
  // can be selected without ever allowing the same jar to fund two orders.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await tx.jarCode.findFirst({
      where: refillJarReservationWhere(input.customerId),
      orderBy: [{ redeemedAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, code: true },
    });
    if (!candidate) return null;

    const claimed = await tx.jarCode.updateMany({
      where: {
        id: candidate.id,
        ...refillJarReservationWhere(input.customerId),
      },
      data: { lockedByRefillOrderId: input.refillOrderId },
    });
    if (claimed.count === 1) return candidate;
  }
  return null;
}

export function canRefreshRefillQualification(input: {
  status: string;
  blockingPaymentCount: number;
}): boolean {
  return (
    ['draft', 'payment_failed'].includes(input.status) &&
    input.blockingPaymentCount === 0
  );
}

async function refreshUnpaidOrderQualification(
  orderId: string,
  customerId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Serialize qualification refreshes for the same order. Without this row
    // lock, two simultaneous page loads could each reserve a different jar for
    // one order even though each individual jar claim is atomic.
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM refill_orders WHERE id = ${orderId} FOR UPDATE`,
    );
    const order = await tx.refillOrder.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: { in: ['pending', 'paid'] } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!order || order.customerId !== customerId) return order;

    // Never reprice an order after a checkout was opened or paid. Those cases
    // require the immutable payment snapshot and an explicit review instead.
    if (
      !canRefreshRefillQualification({
        status: order.status,
        blockingPaymentCount: order.payments.length,
      })
    ) {
      return order;
    }

    let reservedJar = await tx.jarCode.findFirst({
      where: {
        lockedByRefillOrderId: order.id,
        redeemedByCustomerId: customerId,
        status: { in: ['used', 'issued'] },
      },
      select: { id: true, code: true },
    });

    if (!reservedJar) {
      await tx.jarCode.updateMany({
        where: { lockedByRefillOrderId: order.id },
        data: { lockedByRefillOrderId: null },
      });
      reservedJar = await reserveAvailableJar(tx, {
        customerId,
        refillOrderId: order.id,
      });
    }

    const orderType: RefillOrderType = reservedJar ? 'exchange' : 'first';
    const amounts = amountsForOrderType(orderType);
    const oldContainerSerial = reservedJar?.code ?? null;
    const unchanged =
      order.orderType === orderType &&
      order.deliveryMode === orderType &&
      order.baseAmount === amounts.baseAmount &&
      order.extraAmount === amounts.extraAmount &&
      order.totalAmount === amounts.totalAmount &&
      order.oldContainerSerial === oldContainerSerial;
    if (unchanged) return order;

    const updated = await tx.refillOrder.update({
      where: { id: order.id },
      data: {
        orderType,
        deliveryMode: orderType,
        baseAmount: amounts.baseAmount,
        extraAmount: amounts.extraAmount,
        totalAmount: amounts.totalAmount,
        oldContainerSerial,
      },
    });
    await writeRefillAudit(tx, {
      refillOrderId: order.id,
      action: 'order_qualification_refreshed',
      actorType: 'system',
      merchantId: order.merchantId,
      detail: {
        previousOrderType: order.orderType,
        orderType,
        previousTotalAmount: order.totalAmount,
        totalAmount: amounts.totalAmount,
        reservedJarCode: oldContainerSerial,
      },
    });
    return updated;
  });
}

export async function countIssuedJars(customerId: string): Promise<number> {
  return prisma.jarCode.count({
    where: refillJarOwnershipWhere(customerId),
  });
}

export async function listRefillBookings(input: {
  customerId: string;
  storeId?: string | null;
}) {
  const now = new Date();
  const rows = await prisma.appointment.findMany({
    where: {
      customerId: input.customerId,
      status: 'confirmed',
      startsAt: { gte: now },
      ...(input.storeId
        ? {
            OR: [
              { merchantId: input.storeId },
              { merchant: { merchantId: input.storeId } },
            ],
          }
        : {}),
    },
    orderBy: { startsAt: 'asc' },
    take: 20,
    include: {
      merchant: { select: { id: true, name: true, merchantId: true } },
    },
  });

  const appointmentIds = rows.map((r) => r.id);
  const activeOrders = appointmentIds.length
    ? await prisma.refillOrder.findMany({
        where: {
          appointmentId: { in: appointmentIds },
          status: { in: [...REFILL_ACTIVE_STATUSES] },
        },
        select: { id: true, appointmentId: true, status: true, totalAmount: true },
      })
    : [];
  const byAppt = new Map(activeOrders.map((o) => [o.appointmentId, o]));

  return rows.map((r) => {
    const active = byAppt.get(r.id) ?? null;
    return {
      appointmentId: r.id,
      petName: r.petName,
      serviceName: r.serviceName,
      date: formatLocalDate(r.startsAt),
      time: formatLocalTime(r.startsAt),
      startsAt: r.startsAt.toISOString(),
      merchantId: r.merchantId,
      merchantName: r.merchant.name,
      merchantCode: r.merchant.merchantId,
      activeOrderId: active?.id ?? null,
      activeOrderStatus: active?.status ?? null,
    };
  });
}

export async function getRefillEligibility(input: {
  customerId: string;
  customerName: string;
  appointmentId?: string | null;
  storeId?: string | null;
}) {
  const issuedCount = await countIssuedJars(input.customerId);
  const hasIssuedJar = issuedCount > 0;
  const orderType: RefillOrderType = hasIssuedJar ? 'exchange' : 'first';
  const amounts = amountsForOrderType(orderType);

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { name: true, petName: true },
  });

  const bookings = await listRefillBookings({
    customerId: input.customerId,
    storeId: input.storeId,
  });

  let selected = null as (typeof bookings)[number] | null;
  if (input.appointmentId) {
    selected = bookings.find((b) => b.appointmentId === input.appointmentId) ?? null;
    if (!selected) {
      const appt = await prisma.appointment.findUnique({
        where: { id: input.appointmentId },
        include: { merchant: { select: { name: true } } },
      });
      if (!appt || appt.customerId !== input.customerId) {
        throw new RefillError('目前找不到可換罐的預約。', 'NO_BOOKING', 404);
      }
      const check = isBookableForRefill({
        status: appt.status,
        startsAt: appt.startsAt,
        merchantId: appt.merchantId,
      });
      if (!check.ok) {
        throw new RefillError(
          check.code === 'BOOKING_NOT_CONFIRMED'
            ? '這筆預約尚未確認，確認後才能付款。'
            : '目前找不到可換罐的預約。',
          check.code ?? 'NO_BOOKING',
          400,
        );
      }
    }
  } else if (bookings.length === 1) {
    selected = bookings[0];
  }

  // open paid orders for customer (any appointment)
  const openPaid = await prisma.refillOrder.findMany({
    where: {
      customerId: input.customerId,
      status: { in: [...REFILL_PAID_OPEN_STATUSES, 'payment_pending', 'draft'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      status: true,
      totalAmount: true,
      appointmentId: true,
      merchantId: true,
    },
  });

  return {
    registered: true,
    customerName: customer?.name ?? input.customerName,
    petName: customer?.petName ?? selected?.petName ?? null,
    hasIssuedJar,
    issuedJarCount: issuedCount,
    orderType,
    amount: amounts.totalAmount,
    message: hasIssuedJar
      ? null
      : '目前沒有可使用的空罐紀錄，這次請選首罐 NT$129。',
    bookings,
    selectedBooking: selected,
    openOrders: openPaid,
  };
}

export async function createRefillOrder(input: {
  customerId: string;
  appointmentId: string;
  /** 前端傳入金額一律忽略 */
  clientAmount?: number;
  idempotencyKey?: string | null;
}) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    include: { merchant: { select: { id: true, name: true } } },
  });
  if (!appointment || appointment.customerId !== input.customerId) {
    throw new RefillError('目前找不到可換罐的預約。', 'NO_BOOKING', 404);
  }

  const bookOk = isBookableForRefill({
    status: appointment.status,
    startsAt: appointment.startsAt,
    merchantId: appointment.merchantId,
  });
  if (!bookOk.ok) {
    throw new RefillError(
      bookOk.code === 'BOOKING_NOT_CONFIRMED'
        ? '這筆預約尚未確認，確認後才能付款。'
        : '目前找不到可換罐的預約。',
      bookOk.code ?? 'NO_BOOKING',
      400,
    );
  }

  const idem =
    input.idempotencyKey?.trim() ||
    `refill:${input.customerId}:${input.appointmentId}`;

  const existingByKey = await prisma.refillOrder.findUnique({
    where: { idempotencyKey: idem },
  });
  if (existingByKey) {
    const refreshed = await refreshUnpaidOrderQualification(
      existingByKey.id,
      input.customerId,
    );
    return { order: refreshed ?? existingByKey, reused: true as const };
  }

  const active = await prisma.refillOrder.findFirst({
    where: {
      appointmentId: input.appointmentId,
      status: { in: [...REFILL_ACTIVE_STATUSES] },
    },
  });
  if (active) {
    const refreshed = await refreshUnpaidOrderQualification(
      active.id,
      input.customerId,
    );
    return { order: refreshed ?? active, reused: true as const };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { petName: true },
  });

  try {
    const order = await prisma.$transaction(async (tx) => {
      const firstAmounts = amountsForOrderType('first');
      let created = await tx.refillOrder.create({
        data: {
          customerId: input.customerId,
          appointmentId: appointment.id,
          merchantId: appointment.merchantId,
          petName: appointment.petName ?? customer?.petName ?? null,
          orderType: 'first',
          baseAmount: firstAmounts.baseAmount,
          extraAmount: firstAmounts.extraAmount,
          totalAmount: firstAmounts.totalAmount,
          status: 'draft',
          deliveryMode: 'first',
          idempotencyKey: idem,
        },
      });

      const reservedJar = await reserveAvailableJar(tx, {
        customerId: input.customerId,
        refillOrderId: created.id,
      });
      const orderType: RefillOrderType = reservedJar ? 'exchange' : 'first';
      const amounts = amountsForOrderType(orderType);

      if (reservedJar) {
        created = await tx.refillOrder.update({
          where: { id: created.id },
          data: {
            orderType,
            deliveryMode: orderType,
            baseAmount: amounts.baseAmount,
            extraAmount: amounts.extraAmount,
            totalAmount: amounts.totalAmount,
            oldContainerSerial: reservedJar.code,
          },
        });
      }

      await writeRefillAudit(tx, {
        refillOrderId: created.id,
        action: 'order_created',
        actorType: 'customer',
        actorId: input.customerId,
        merchantId: appointment.merchantId,
        detail: {
          orderType,
          totalAmount: amounts.totalAmount,
          reservedJarCode: reservedJar?.code ?? null,
          clientAmountIgnored: input.clientAmount ?? null,
        },
      });
      return created;
    });
    return { order, reused: false as const };
  } catch (e) {
    // unique idempotency race
    const again = await prisma.refillOrder.findUnique({ where: { idempotencyKey: idem } });
    if (again) return { order: again, reused: true as const };
    throw e;
  }
}

export async function getRefillOrderForCustomer(orderId: string, customerId: string) {
  const order = await prisma.refillOrder.findUnique({
    where: { id: orderId },
    include: {
      merchant: { select: { id: true, name: true, merchantId: true } },
      appointment: {
        select: { id: true, startsAt: true, petName: true, status: true, serviceName: true },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
  if (!order || order.customerId !== customerId) {
    throw new RefillError('找不到這筆換罐訂單。', 'ORDER_NOT_FOUND', 404);
  }
  return serializeOrder(order);
}

export function serializeOrder(order: {
  id: string;
  status: string;
  orderType: string;
  deliveryMode: string;
  baseAmount: number;
  extraAmount: number;
  totalAmount: number;
  petName: string | null;
  oldContainerSerial: string | null;
  newContainerSerial: string | null;
  missingContainerNote: string | null;
  paidAt: Date | null;
  completedAt: Date | null;
  merchant: { id: string; name: string; merchantId: string };
  appointment: {
    id: string;
    startsAt: Date;
    petName: string | null;
    status: string;
    serviceName: string;
  };
  payments?: { id: string; purpose: string; amount: number; status: string; merchantTradeNo: string }[];
}) {
  return {
    id: order.id,
    status: order.status,
    orderType: order.orderType,
    deliveryMode: order.deliveryMode,
    baseAmount: order.baseAmount,
    extraAmount: order.extraAmount,
    totalAmount: order.totalAmount,
    petName: order.petName ?? order.appointment.petName,
    merchantId: order.merchant.id,
    merchantName: order.merchant.name,
    merchantCode: order.merchant.merchantId,
    appointmentId: order.appointment.id,
    date: formatLocalDate(order.appointment.startsAt),
    time: formatLocalTime(order.appointment.startsAt),
    serviceName: order.appointment.serviceName,
    oldContainerSerial: order.oldContainerSerial,
    newContainerSerial: order.newContainerSerial,
    missingContainerNote: order.missingContainerNote,
    paidAt: order.paidAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    payments: order.payments ?? [],
  };
}
