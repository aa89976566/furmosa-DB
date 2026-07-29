import { prisma } from '@/lib/prisma';
import { pushLineMessages } from '@/lib/line/push';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { getPointsBalance } from '@/lib/jar-exchange/points';

export async function notifyRefillPaid(refillOrderId: string) {
  const order = await prisma.refillOrder.findUnique({
    where: { id: refillOrderId },
    include: {
      customer: { select: { lineUserId: true } },
      merchant: { select: { name: true } },
      appointment: { select: { startsAt: true, petName: true } },
    },
  });
  if (!order?.customer.lineUserId) return;

  const pet = order.petName ?? order.appointment.petName ?? '毛孩';
  const date = `${formatLocalDate(order.appointment.startsAt)} ${formatLocalTime(order.appointment.startsAt)}`;
  const text = [
    `${pet} 的換罐付款完成。`,
    '',
    `到${order.merchant.name}時，記得帶空罐。`,
    '店家確認瓶底序號後，就可以帶新的一罐回家。',
    '',
    `金額：NT$${order.totalAmount}`,
    '狀態：等待到店換罐',
    `預約：${date}`,
  ].join('\n');

  await pushLineMessages(order.customer.lineUserId, [{ type: 'text', text }]);
}

export async function notifyRefillCompleted(refillOrderId: string, pointsAwarded: boolean) {
  const order = await prisma.refillOrder.findUnique({
    where: { id: refillOrderId },
    include: {
      customer: { select: { id: true, lineUserId: true } },
    },
  });
  if (!order?.customer.lineUserId) return;

  const pet = order.petName ?? '毛孩';
  let pointsLine = '';
  if (pointsAwarded) {
    const balance = await getPointsBalance(prisma, order.customer.id);
    pointsLine = `\n本次增加 1 點。\n目前共 ${balance} 點。`;
  }

  const text = [
    `${pet} 今天換罐完成。`,
    '',
    '舊罐已回收，新罐已登記。',
    pointsLine,
  ]
    .filter(Boolean)
    .join('\n');

  await pushLineMessages(order.customer.lineUserId, [{ type: 'text', text }]);
}
