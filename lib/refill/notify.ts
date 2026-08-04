import { prisma } from '@/lib/prisma';
import { pushLineMessages } from '@/lib/line/push';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { getPointsBalance } from '@/lib/jar-exchange/points';
import { formatFlavourLabel } from '@/lib/jar-exchange/refill-plan-content';
import { buildPaidNotifyText } from '@/lib/refill/copy';

export async function notifyRefillPaid(refillOrderId: string) {
  const order = await prisma.refillOrder.findUnique({
    where: { id: refillOrderId },
    include: {
      customer: { select: { lineUserId: true } },
      merchant: { select: { name: true } },
      appointment: { select: { startsAt: true, petName: true } },
      preferredFlavour: { select: { name: true, weightGrams: true } },
    },
  });
  if (!order?.customer.lineUserId) return;

  const pet = order.petName ?? order.appointment.petName ?? '毛孩';
  const date = `${formatLocalDate(order.appointment.startsAt)} ${formatLocalTime(order.appointment.startsAt)}`;
  const preferredLabel = order.preferredFlavour
    ? formatFlavourLabel(order.preferredFlavour.name, order.preferredFlavour.weightGrams)
    : null;
  const isExchange = order.deliveryMode === 'exchange' && order.orderType === 'exchange';

  const text = [
    `${pet} 的換罐付款完成。`,
    '',
    buildPaidNotifyText({
      petName: pet,
      merchantName: order.merchant.name,
      amount: order.totalAmount,
      dateLine: date,
      orderIdShort: order.id.slice(0, 8).toUpperCase(),
      preferredLabel,
      isExchange,
    }),
  ].join('\n');

  await pushLineMessages(order.customer.lineUserId, [{ type: 'text', text }]);
}

export async function notifyRefillCompleted(refillOrderId: string, pointsAwarded: boolean) {
  const order = await prisma.refillOrder.findUnique({
    where: { id: refillOrderId },
    include: {
      customer: { select: { id: true, lineUserId: true } },
      fulfilledFlavour: { select: { name: true, weightGrams: true } },
      preferredFlavour: { select: { name: true, weightGrams: true } },
      merchant: { select: { name: true } },
    },
  });
  if (!order?.customer.lineUserId) return;

  const pet = order.petName ?? '毛孩';
  let pointsLine = '';
  if (pointsAwarded) {
    const balance = await getPointsBalance(prisma, order.customer.id);
    pointsLine = `\n本次增加 1 點。\n目前共 ${balance} 點。`;
  }

  const actual = order.fulfilledFlavour
    ? formatFlavourLabel(order.fulfilledFlavour.name, order.fulfilledFlavour.weightGrams)
    : null;
  const preferred = order.preferredFlavour
    ? formatFlavourLabel(order.preferredFlavour.name, order.preferredFlavour.weightGrams)
    : null;

  const text = [
    `${pet} 今天換罐完成。`,
    '',
    actual ? `實際交付口味：${actual}` : null,
    preferred && preferred !== actual ? `原先希望：${preferred}` : null,
    `領取店家：${order.merchant.name}`,
    '舊罐已回收，新罐已登記。',
    pointsLine,
  ]
    .filter(Boolean)
    .join('\n');

  await pushLineMessages(order.customer.lineUserId, [{ type: 'text', text }]);
}
