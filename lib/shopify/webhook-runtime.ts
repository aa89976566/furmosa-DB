import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { waitUntil } from '@vercel/functions';
import { sendNewOrderPush } from '@/lib/web-push';
import { persistShopifyIntake } from './intake';
import { shopifyWebhookHandler } from './webhook-handler';
import type { ShopifyOrderTopic } from './intake-policy';

export function orderWebhook(topic: ShopifyOrderTopic) {
  return shopifyWebhookHandler(topic, {
    secret: () => process.env.SHOPIFY_WEBHOOK_SECRET ?? '',
    domain: () => process.env.SHOPIFY_SHOP_DOMAIN ?? '',
    persist: event => persistShopifyIntake(prisma, event),
    logError: code => console.error('[shopify.intake]', code),
    onSaved: (result, event) => {
      waitUntil(Promise.resolve().then(async () => {
        for (const path of ['/orders', '/reviews', '/dashboard']) revalidatePath(path);
        if (result.created) {
          const order = await prisma.order.findUnique({ where: { externalStore_externalOrderId: {
            externalStore: event.shopDomain, externalOrderId: String(event.snapshot.order.id),
          } } });
          if (order) await sendNewOrderPush({ id: order.id, orderNumber: order.orderNumber,
            total: order.total, source: 'shopify', needsReview: true });
        }
      }).catch(() => console.error('[shopify.intake]', 'POST_INTAKE_NOTIFICATION_FAILED')));
    },
  });
}
