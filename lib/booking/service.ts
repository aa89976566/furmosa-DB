import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { nextCustomerId } from '@/lib/customers/customer-id';
import {
  APPOINTMENT_OCCUPYING_STATUSES,
  type AppointmentCreatedBy,
} from '@/lib/booking/constants';
import {
  buildDaySlots,
  formatLocalDate,
  parseLocalDate,
  scheduleFromSettings,
  type SlotCandidate,
} from '@/lib/booking/availability';
import { ensureMerchantSettings } from '@/lib/restock-request/service';
import {
  fireAndForget,
  notifyAppointmentConfirmed,
  notifyAppointmentRequested,
  notifyAppointmentRescheduled,
} from '@/lib/booking/notify';
import { bindCustomerLineUserId } from '@/lib/line/bind-customer';

type Db = Prisma.TransactionClient | typeof prisma;

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function getBookingSchedule(merchantId: string, db: Db = prisma) {
  const settings = await ensureMerchantSettings(merchantId, db);
  return { settings, schedule: scheduleFromSettings(settings) };
}

async function occupancyMap(
  merchantId: string,
  dayStart: Date,
  dayEnd: Date,
  db: Db,
): Promise<Map<number, number>> {
  const rows = await db.appointment.findMany({
    where: {
      merchantId,
      status: { in: [...APPOINTMENT_OCCUPYING_STATUSES] },
      startsAt: { gte: dayStart, lt: dayEnd },
    },
    select: { startsAt: true },
  });
  const map = new Map<number, number>();
  for (const r of rows) {
    const k = r.startsAt.getTime();
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

export async function listSlotsForDay(input: {
  merchantId: string;
  dateStr: string;
  /** customer = hide full slots; merchant = show all with occupancy */
  audience: 'customer' | 'merchant';
}): Promise<SlotCandidate[]> {
  const day = parseLocalDate(input.dateStr);
  if (!day) throw new Error('日期格式不正確');

  const { schedule } = await getBookingSchedule(input.merchantId);
  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const occ = await occupancyMap(input.merchantId, day, dayEnd, prisma);
  const slots = buildDaySlots(day, schedule, occ);
  if (input.audience === 'customer') {
    return slots.filter((s) => !s.isFull);
  }
  return slots;
}

export async function listServiceProductsForBooking() {
  const products = await prisma.product.findMany({
    where: { status: 'active', productCategory: 'SERVICE' },
    select: { id: true, name: true, price: true },
    orderBy: { name: 'asc' },
  });
  if (products.length > 0) return products;
  return [{ id: null as string | null, name: '美容', price: 0 }];
}

export async function findOrCreateCustomerByPhone(input: {
  name: string;
  phone: string;
  petName?: string | null;
  /** 可選：公開預約經 LIFF 驗證後綁定，供 Round 2 通知 */
  lineUserId?: string | null;
}) {
  const phone = input.phone.trim();
  const digits = normalizePhone(phone);
  if (!input.name.trim()) throw new Error('請填寫姓名');
  if (digits.length < 8) throw new Error('請填寫有效電話');

  const existing = await prisma.customer.findFirst({
    where: {
      OR: [
        { phone },
        { phone: digits },
        { phone: { contains: digits.slice(-9) } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    let row = existing;
    if (input.petName?.trim() && !existing.petName) {
      row = await prisma.customer.update({
        where: { id: existing.id },
        data: { petName: input.petName.trim() },
      });
    }
    if (input.lineUserId?.trim() && !row.lineUserId) {
      await bindCustomerLineUserId(row.id, input.lineUserId.trim());
      return prisma.customer.findUniqueOrThrow({ where: { id: row.id } });
    }
    return row;
  }

  const created = await prisma.customer.create({
    data: {
      customerId: await nextCustomerId(),
      name: input.name.trim(),
      phone: digits,
      petName: input.petName?.trim() || null,
      type: 'individual',
      lineUserId: input.lineUserId?.trim() || null,
    },
  });
  return created;
}

async function resolveSlotInTx(
  tx: Prisma.TransactionClient,
  input: {
    merchantId: string;
    startsAt: Date;
    allowOverbook: boolean;
    ignoreAppointmentId?: string;
  },
) {
  const { schedule } = await getBookingSchedule(input.merchantId, tx);
  const dateStr = formatLocalDate(input.startsAt);
  const day = parseLocalDate(dateStr);
  if (!day) throw new Error('日期格式不正確');
  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const rows = await tx.appointment.findMany({
    where: {
      merchantId: input.merchantId,
      status: { in: [...APPOINTMENT_OCCUPYING_STATUSES] },
      startsAt: { gte: day, lt: dayEnd },
      ...(input.ignoreAppointmentId
        ? { NOT: { id: input.ignoreAppointmentId } }
        : {}),
    },
    select: { startsAt: true },
  });
  const map = new Map<number, number>();
  for (const r of rows) {
    const k = r.startsAt.getTime();
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const slots = buildDaySlots(day, schedule, map);
  const match = slots.find((s) => s.startsAt.getTime() === input.startsAt.getTime());
  if (!match) {
    throw new Error('這個時間不在店家可預約時段內');
  }
  if (match.isFull && !input.allowOverbook) {
    throw new Error('這個時間剛約滿，請另選');
  }
  return match;
}

export async function submitCustomerBooking(input: {
  merchantId: string;
  startsAt: Date;
  customerName: string;
  customerPhone: string;
  petName?: string | null;
  customerNote?: string | null;
  serviceProductId?: string | null;
  serviceName?: string | null;
  lineUserId?: string | null;
}) {
  const merchant = await prisma.merchant.findFirst({
    where: { id: input.merchantId, status: 'active' },
    select: { id: true },
  });
  if (!merchant) throw new Error('找不到店家');

  const settings = await ensureMerchantSettings(input.merchantId);
  if (!settings.appointmentEnabled) {
    throw new Error('這間店還沒開放線上預約');
  }

  let serviceName = input.serviceName?.trim() || '';
  let serviceProductId = input.serviceProductId || null;
  if (serviceProductId) {
    const p = await prisma.product.findFirst({
      where: { id: serviceProductId, productCategory: 'SERVICE', status: 'active' },
      select: { id: true, name: true },
    });
    if (!p) throw new Error('找不到這個服務');
    serviceName = p.name;
    serviceProductId = p.id;
  }
  if (!serviceName) serviceName = '美容';

  const customer = await findOrCreateCustomerByPhone({
    name: input.customerName,
    phone: input.customerPhone,
    petName: input.petName,
    lineUserId: input.lineUserId,
  });

  // Serializable tx: capacity check + create must not race into double-book
  const created = await prisma.$transaction(
    async (tx) => {
      const slot = await resolveSlotInTx(tx, {
        merchantId: input.merchantId,
        startsAt: input.startsAt,
        allowOverbook: false,
      });
      return tx.appointment.create({
        data: {
          merchantId: input.merchantId,
          customerId: customer.id,
          serviceProductId,
          serviceName,
          petName: input.petName?.trim() || customer.petName,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: 'requested',
          customerNote: input.customerNote?.trim() || null,
          createdBy: 'customer' satisfies AppointmentCreatedBy,
          isOverbooked: false,
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );

  fireAndForget(() => notifyAppointmentRequested(created.id));
  return created;
}

export async function createMerchantAppointment(input: {
  merchantId: string;
  startsAt: Date;
  customerName: string;
  customerPhone: string;
  petName?: string | null;
  customerNote?: string | null;
  merchantNote?: string | null;
  serviceProductId?: string | null;
  serviceName?: string | null;
  /** Merchant/HQ may overbook */
  allowOverbook?: boolean;
  createdBy?: Extract<AppointmentCreatedBy, 'merchant' | 'hq'>;
}) {
  const allowOverbook = input.allowOverbook !== false;

  let serviceName = input.serviceName?.trim() || '美容';
  let serviceProductId = input.serviceProductId || null;
  if (serviceProductId) {
    const p = await prisma.product.findFirst({
      where: { id: serviceProductId },
      select: { id: true, name: true },
    });
    if (p) {
      serviceName = p.name;
      serviceProductId = p.id;
    }
  }

  const customer = await findOrCreateCustomerByPhone({
    name: input.customerName,
    phone: input.customerPhone,
    petName: input.petName,
  });

  return prisma.$transaction(
    async (tx) => {
      const slot = await resolveSlotInTx(tx, {
        merchantId: input.merchantId,
        startsAt: input.startsAt,
        allowOverbook,
      });
      const isOverbooked = slot.isFull && allowOverbook;
      return tx.appointment.create({
        data: {
          merchantId: input.merchantId,
          customerId: customer.id,
          serviceProductId,
          serviceName,
          petName: input.petName?.trim() || customer.petName,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: 'confirmed',
          customerNote: input.customerNote?.trim() || null,
          merchantNote: input.merchantNote?.trim() || null,
          createdBy: input.createdBy ?? 'merchant',
          isOverbooked,
          confirmedAt: new Date(),
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function confirmAppointment(input: {
  appointmentId: string;
  merchantId: string;
}) {
  const row = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, merchantId: input.merchantId },
  });
  if (!row) throw new Error('找不到這張預約');
  if (row.status === 'cancelled') throw new Error('這張預約已取消');
  if (row.status === 'confirmed') {
    fireAndForget(() => notifyAppointmentConfirmed(row.id));
    return row;
  }

  const updated = await prisma.appointment.update({
    where: { id: row.id },
    data: {
      status: 'confirmed',
      confirmedAt: new Date(),
      proposedStartsAt: null,
      proposedEndsAt: null,
    },
  });
  fireAndForget(() => notifyAppointmentConfirmed(updated.id));
  return updated;
}

export async function proposeAndApplyReschedule(input: {
  appointmentId: string;
  merchantId: string;
  newStartsAt: Date;
}) {
  const row = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, merchantId: input.merchantId },
  });
  if (!row) throw new Error('找不到這張預約');
  if (row.status === 'cancelled') throw new Error('這張預約已取消');

  // Temporarily ignore this appointment when checking capacity
  const dateStr = formatLocalDate(input.newStartsAt);
  const { schedule } = await getBookingSchedule(input.merchantId);
  const day = parseLocalDate(dateStr)!;
  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const rows = await prisma.appointment.findMany({
    where: {
      merchantId: input.merchantId,
      status: { in: [...APPOINTMENT_OCCUPYING_STATUSES] },
      startsAt: { gte: day, lt: dayEnd },
      NOT: { id: row.id },
    },
    select: { startsAt: true },
  });
  const map = new Map<number, number>();
  for (const r of rows) {
    const k = r.startsAt.getTime();
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const slots = buildDaySlots(day, schedule, map);
  const match = slots.find((s) => s.startsAt.getTime() === input.newStartsAt.getTime());
  if (!match) throw new Error('新的時間不在可預約時段內');
  // Merchant may apply even if full (authority)
  const isOverbooked = match.isFull;

  const updated = await prisma.appointment.update({
    where: { id: row.id },
    data: {
      startsAt: match.startsAt,
      endsAt: match.endsAt,
      status: 'confirmed',
      proposedStartsAt: null,
      proposedEndsAt: null,
      confirmedAt: row.confirmedAt ?? new Date(),
      isOverbooked: row.isOverbooked || isOverbooked,
    },
  });
  fireAndForget(() => notifyAppointmentRescheduled(updated.id));
  return updated;
}

export async function cancelAppointment(input: {
  appointmentId: string;
  merchantId: string;
}) {
  const row = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, merchantId: input.merchantId },
  });
  if (!row) throw new Error('找不到這張預約');
  if (row.status === 'cancelled') return row;

  return prisma.appointment.update({
    where: { id: row.id },
    data: { status: 'cancelled', cancelledAt: new Date() },
  });
}

export async function updateMerchantBookingSchedule(input: {
  merchantId: string;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  capacityPerSlot: number;
  weekdays: string;
  appointmentEnabled?: boolean;
  bookingNotifyLineUserId?: string | null;
}) {
  await ensureMerchantSettings(input.merchantId);
  const notifyId = input.bookingNotifyLineUserId?.trim() || null;
  if (notifyId && !notifyId.startsWith('U')) {
    throw new Error('LINE 通知對象請填 U 開頭的 User ID');
  }
  return prisma.merchantSettings.update({
    where: { merchantId: input.merchantId },
    data: {
      bookingOpenTime: input.openTime,
      bookingCloseTime: input.closeTime,
      bookingSlotMinutes: input.slotMinutes,
      bookingCapacityPerSlot: input.capacityPerSlot,
      bookingWeekdays: input.weekdays,
      appointmentEnabled: input.appointmentEnabled ?? true,
      ...(input.bookingNotifyLineUserId !== undefined
        ? { bookingNotifyLineUserId: notifyId }
        : {}),
    },
  });
}

export async function countPendingAppointments(merchantId: string) {
  return prisma.appointment.count({
    where: { merchantId, status: 'requested' },
  });
}
