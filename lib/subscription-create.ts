import { addMonths } from 'date-fns';
import { prisma } from '@/lib/prisma';
import {
  generateShipmentDates,
  getNextShipmentDate,
  parseShipDays,
} from '@/lib/subscription';

const pad = (n: number, width = 3) => String(n).padStart(width, '0');

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function nextSubscriptionNo(startDate: Date) {
  const prefix = `SUB-${ymd(startDate)}-`;
  const last = await prisma.subscription.findFirst({
    where: { subscriptionNo: { startsWith: prefix } },
    orderBy: { subscriptionNo: 'desc' },
  });
  const seq = last ? Number(last.subscriptionNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${pad(seq, 3)}`;
}

async function reserveSubscriptionShipmentNos(count: number, d = new Date()) {
  if (count <= 0) return [];
  const prefix = `SHIP-${ymd(d)}-`;
  const last = await prisma.subscriptionShipment.findFirst({
    where: { shipmentNo: { startsWith: prefix } },
    orderBy: { shipmentNo: 'desc' },
  });
  let seq = 1;
  if (last) {
    const parsed = Number(last.shipmentNo.slice(prefix.length));
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }
  return Array.from({ length: count }, (_, i) => `${prefix}${pad(seq + i, 3)}`);
}

export type CreateSubscriptionInput = {
  customerId: string;
  planId: string;
  billingCycle: 'monthly' | 'halfyear';
  startDate: Date;
  endDate: Date | null;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  paymentType: 'full' | 'monthly' | 'other';
  paymentNote: string | null;
  notes: string | null;
};

export async function createSubscriptionRecord(input: CreateSubscriptionInput) {
  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, name: true },
  });
  if (!customer) throw new Error('客戶不存在');

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: input.planId },
  });
  if (!plan) throw new Error('方案不存在');
  if (!plan.isActive) throw new Error('此方案已停用，請選擇其他方案');

  let endDate = input.endDate;
  if (input.billingCycle === 'halfyear' && !endDate) {
    endDate = addMonths(input.startDate, 6);
  }

  const subscriptionNo = await nextSubscriptionNo(input.startDate);
  const shipDays = parseShipDays(plan.shipDays);
  const rangeEnd = addMonths(input.startDate, 2);

  const sub = await prisma.subscription.create({
    data: {
      subscriptionNo,
      customerId: input.customerId,
      planId: input.planId,
      status: 'active',
      billingCycle: input.billingCycle,
      startDate: input.startDate,
      endDate,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      shippingAddress: input.shippingAddress,
      paymentType: input.paymentType,
      paymentNote: input.paymentNote,
      notes: input.notes,
    },
  });

  const scheduledDates = generateShipmentDates({
    startDate: input.startDate,
    endDate,
    shipDays,
    rangeStart: input.startDate,
    rangeEnd,
  });

  const shipmentNos = await reserveSubscriptionShipmentNos(scheduledDates.length);
  const now = new Date();
  let nextShipmentDate: Date | null = null;

  for (let i = 0; i < scheduledDates.length; i++) {
    const date = scheduledDates[i];
    if (!nextShipmentDate && date >= now) nextShipmentDate = date;
    await prisma.subscriptionShipment.create({
      data: {
        shipmentNo: shipmentNos[i],
        subscriptionId: sub.id,
        scheduledDate: date,
        status: 'pending',
      },
    });
  }

  if (!nextShipmentDate) {
    nextShipmentDate = getNextShipmentDate({
      startDate: input.startDate,
      endDate,
      shipDays,
      after: now,
    });
  }

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { nextShipmentDate },
  });

  await prisma.customer.update({
    where: { id: input.customerId },
    data: { hasActiveSubscription: true },
  });

  return sub;
}
