import { prisma } from '@/lib/prisma';
import { pushLineMessages } from '@/lib/line/push';
import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { getPointsBalance } from '@/lib/jar-exchange/points';
import { getLiffUrlIfConfigured } from '@/lib/line/liff-config';
import type { LinePushMessage } from '@/lib/line/push';

function refillProgressUrl(orderId: string): string | null {
  const baseUrl = getLiffUrlIfConfigured('refill');
  if (!baseUrl) return null;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}orderId=${encodeURIComponent(orderId)}&paid=1`;
}

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
  const isFirstJar = order.orderType === 'first' || order.deliveryMode === 'first';
  const text = [
    '付款完成啦',
    `${pet} 的換罐已經預約好`,
    '',
    `${order.merchant.name}｜${date}`,
    isFirstJar
      ? '這次是首罐 NT$129，不用帶空罐'
      : '這次是續罐 NT$99，記得帶空罐到店裡',
    '',
    '到店後給店員看這則訊息就可以',
  ].join('\n');

  const progressUrl = refillProgressUrl(order.id);
  const message: LinePushMessage = {
    type: 'text',
    text,
    ...(progressUrl
      ? {
          quickReply: {
            items: [
              {
                type: 'action',
                action: { type: 'uri', label: '查看換罐進度', uri: progressUrl },
              },
            ],
          },
        }
      : {}),
  };

  const result = await pushLineMessages(order.customer.lineUserId, [message], { expand: false });
  if (!result.ok) throw new Error(result.error);
}

export async function notifyRefillCompleted(refillOrderId: string, pointsAwarded: boolean) {
  const order = await prisma.refillOrder.findUnique({
    where: { id: refillOrderId },
    include: {
      customer: { select: { id: true, lineUserId: true } },
      merchant: { select: { name: true } },
    },
  });
  if (!order?.customer.lineUserId) return;

  const pet = order.petName ?? '毛孩';
  const lines = [
    '換罐完成 🎉',
    `${pet} 的新罐已經領到`,
    '',
    `領取店家｜${order.merchant.name}`,
  ];

  if (pointsAwarded) {
    const balance = await getPointsBalance(prisma, order.customer.id);
    lines.push(`這次 +1 點，目前有 ${balance} 點`);
  } else {
    lines.push('拿到新罐後，把罐底 8 位數字傳給我就會自動入點');
  }

  lines.push('', '下次要換罐，直接打「我要換罐」就好');

  const result = await pushLineMessages(
    order.customer.lineUserId,
    [{ type: 'text', text: lines.join('\n') }],
    { expand: false },
  );
  if (!result.ok) throw new Error(result.error);
}
