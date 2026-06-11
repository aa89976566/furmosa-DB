import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { orderSourceLabel } from '@/lib/labels';
import { formatCurrency } from '@/lib/format';

let configured = false;

function ensureWebPushConfigured(): boolean {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() ?? 'mailto:admin@furmosa.com';

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() ?? null;
}

export function isWebPushConfigured() {
  return Boolean(getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());
}

type NewOrderPushInput = {
  id: string;
  orderNumber: string;
  total: number;
  source: string;
};

export async function sendNewOrderPush(order: NewOrderPushInput) {
  if (!ensureWebPushConfigured()) return;

  const subscriptions = await prisma.userPushSubscription.findMany();
  if (subscriptions.length === 0) return;

  const source = orderSourceLabel[order.source] ?? order.source;
  const payload = JSON.stringify({
    title: `新訂單 ${order.orderNumber}`,
    body: `${source} · ${formatCurrency(order.total)}`,
    tag: order.id,
    url: `/orders/${order.id}`,
    icon: '/icons/icon.svg',
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.userPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }),
  );
}
