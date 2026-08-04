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
import { listActiveRefillFlavours } from '@/lib/jar-exchange/refill-flavours';
import { formatFlavourLabel } from '@/lib/jar-exchange/refill-plan-content';
import { assertPaymentDoesNotLockFlavour } from '@/lib/refill/fulfilment-rules';

export async function countIssuedJars(customerId: string): Promise<number> {
  return prisma.jarCode.count({
    where: {
      redeemedByCustomerId: customerId,
      status: 'issued',
      lockedByRefillOrderId: null,
    },
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

  const flavours = await listActiveRefillFlavours();

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
    /** 參考用；不保證保留、付款不扣庫存 */
    flavours: flavours.map((f) => ({
      id: f.id,
      code: f.code,
      label: f.label,
    })),
  };
}

async function resolvePreferredFlavourId(
  preferredFlavourId: string | null | undefined,
): Promise<string | null> {
  if (preferredFlavourId == null || preferredFlavourId === '' || preferredFlavourId === '__decide_at_store__') {
    return null;
  }
  // ignore fallback ids from client cache
  if (preferredFlavourId.startsWith('fallback-')) {
    return null;
  }
  const flavour = await prisma.refillFlavour.findFirst({
    where: { id: preferredFlavourId, isActive: true },
    select: { id: true },
  });
  if (!flavour) {
    throw new RefillError('找不到這個口味，請重新選擇。', 'FLAVOUR_NOT_FOUND', 400);
  }
  return flavour.id;
}

export async function createRefillOrder(input: {
  customerId: string;
  appointmentId: string;
  /** 希望口味；null／省略＝到店再選。不鎖庫存、不寫入 fulfilled */
  preferredFlavourId?: string | null;
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

  const preferredFlavourId = await resolvePreferredFlavourId(input.preferredFlavourId);

  // 付款資格不得鎖死實際口味或扣庫存
  assertPaymentDoesNotLockFlavour({
    preferredFlavourId,
    fulfilledFlavourId: null,
    stockDecrementedAtPayment: false,
  });

  const existingByKey = await prisma.refillOrder.findUnique({
    where: { idempotencyKey: idem },
  });
  if (existingByKey) {
    if (
      preferredFlavourId !== undefined &&
      (existingByKey.status === 'draft' || existingByKey.status === 'payment_pending') &&
      existingByKey.preferredFlavourId !== preferredFlavourId
    ) {
      const updated = await prisma.refillOrder.update({
        where: { id: existingByKey.id },
        data: { preferredFlavourId },
      });
      return { order: updated, reused: true as const };
    }
    return { order: existingByKey, reused: true as const };
  }

  const active = await prisma.refillOrder.findFirst({
    where: {
      appointmentId: input.appointmentId,
      status: { in: [...REFILL_ACTIVE_STATUSES] },
    },
  });
  if (active) {
    if (
      (active.status === 'draft' || active.status === 'payment_pending') &&
      active.preferredFlavourId !== preferredFlavourId
    ) {
      const updated = await prisma.refillOrder.update({
        where: { id: active.id },
        data: { preferredFlavourId },
      });
      return { order: updated, reused: true as const };
    }
    return { order: active, reused: true as const };
  }

  const hasIssuedJar = (await countIssuedJars(input.customerId)) > 0;
  const orderType: RefillOrderType = hasIssuedJar ? 'exchange' : 'first';
  const amounts = amountsForOrderType(orderType);

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { petName: true },
  });

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.refillOrder.create({
        data: {
          customerId: input.customerId,
          appointmentId: appointment.id,
          merchantId: appointment.merchantId,
          petName: appointment.petName ?? customer?.petName ?? null,
          preferredFlavourId,
          fulfilledFlavourId: null,
          orderType,
          baseAmount: amounts.baseAmount,
          extraAmount: amounts.extraAmount,
          totalAmount: amounts.totalAmount,
          status: 'draft',
          deliveryMode: orderType === 'first' ? 'first' : 'exchange',
          idempotencyKey: idem,
        },
      });
      await writeRefillAudit(tx, {
        refillOrderId: created.id,
        action: 'order_created',
        actorType: 'customer',
        actorId: input.customerId,
        merchantId: appointment.merchantId,
        detail: {
          orderType,
          totalAmount: amounts.totalAmount,
          preferredFlavourId,
          fulfilledFlavourId: null,
          stockReserved: false,
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
      preferredFlavour: { select: { id: true, name: true, weightGrams: true } },
      fulfilledFlavour: { select: { id: true, name: true, weightGrams: true } },
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
  preferredFlavourId?: string | null;
  fulfilledFlavourId?: string | null;
  fulfilledByUserId?: string | null;
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
  preferredFlavour?: { id: string; name: string; weightGrams: number } | null;
  fulfilledFlavour?: { id: string; name: string; weightGrams: number } | null;
  payments?: { id: string; purpose: string; amount: number; status: string; merchantTradeNo: string }[];
}) {
  const preferredLabel = order.preferredFlavour
    ? formatFlavourLabel(order.preferredFlavour.name, order.preferredFlavour.weightGrams)
    : null;
  const fulfilledLabel = order.fulfilledFlavour
    ? formatFlavourLabel(order.fulfilledFlavour.name, order.fulfilledFlavour.weightGrams)
    : null;

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
    preferredFlavourId: order.preferredFlavourId ?? order.preferredFlavour?.id ?? null,
    preferredFlavourLabel: preferredLabel,
    fulfilledFlavourId: order.fulfilledFlavourId ?? order.fulfilledFlavour?.id ?? null,
    fulfilledFlavourLabel: fulfilledLabel,
    oldContainerSerial: order.oldContainerSerial,
    newContainerSerial: order.newContainerSerial,
    missingContainerNote: order.missingContainerNote,
    paidAt: order.paidAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    payments: order.payments ?? [],
  };
}
