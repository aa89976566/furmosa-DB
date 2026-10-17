import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import {
  newOrderNotifyCopy,
  type NewOrderNotifyInput,
} from '@/lib/notifications/new-order-copy';

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

type NewOrderPushInput = NewOrderNotifyInput;

type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
  icon: string;
};

async function sendPushPayload(
  payload: PushPayload,
  options?: { userId?: string },
) {
  if (!ensureWebPushConfigured()) {
    return { configured: false, attempted: 0, delivered: 0 };
  }

  const subscriptions = await prisma.userPushSubscription.findMany({
    where: options?.userId ? { userId: options.userId } : undefined,
  });
  if (subscriptions.length === 0) {
    return { configured: true, attempted: 0, delivered: 0 };
  }

  const serializedPayload = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          serializedPayload,
        );
        return true;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.userPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        return false;
      }
    }),
  );

  return {
    configured: true,
    attempted: subscriptions.length,
    delivered: results.filter(
      (result) => result.status === 'fulfilled' && result.value,
    ).length,
  };
}

export async function sendNewOrderPush(order: NewOrderPushInput) {
  const copy = newOrderNotifyCopy(order);
  await sendPushPayload({
    title: copy.title,
    body: copy.body,
    tag: order.id,
    url: copy.url,
    icon: '/icons/icon.svg',
  });
}

export async function sendTestPush(userId: string) {
  return sendPushPayload(
    {
      title: '新訂單通知測試',
      body: '手機推播已正常連線。之後有新訂單時，會在這裡通知您。',
      tag: `push-test-${Date.now()}`,
      url: '/orders',
      icon: '/icons/icon.svg',
    },
    { userId },
  );
}
