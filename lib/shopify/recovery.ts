import type { Prisma, PrismaClient } from '@prisma/client';
import { persistShopifyIntake, type IntakeEvent } from './intake';
import { SHOPIFY_ORDER_TOPICS, type ShopifyOrderTopic, type Snapshot } from './intake-policy';

const MAX_RECOVERY_ATTEMPTS = 10;

function recoverableTopic(value: string): value is ShopifyOrderTopic {
  return (SHOPIFY_ORDER_TOPICS as readonly string[]).includes(value);
}

function recoverableSnapshot(value: Prisma.JsonValue | null): value is Snapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return snapshot.schemaVersion === 1 && Boolean(snapshot.order) &&
    typeof snapshot.order === 'object' && !Array.isArray(snapshot.order);
}

export async function retryFailedShopifyIntakes(
  db: PrismaClient,
  limit = 10,
  persist: (db: PrismaClient, event: IntakeEvent) => ReturnType<typeof persistShopifyIntake> = persistShopifyIntake,
) {
  const now = new Date();
  const events = await db.shopifyWebhookEvent.findMany({
    where: {
      status: 'FAILED',
      attempts: { lt: MAX_RECOVERY_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { receivedAt: 'asc' },
    take: Math.max(1, Math.min(limit, 25)),
    select: { id: true, shopDomain: true, topic: true, eventId: true, payload: true },
  });

  let recovered = 0;
  let failed = 0;
  let ignored = 0;
  for (const event of events) {
    if (!recoverableTopic(event.topic) || !recoverableSnapshot(event.payload)) {
      await db.shopifyWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'IGNORED', lastErrorCode: 'UNRECOVERABLE_PAYLOAD', nextAttemptAt: null },
      });
      ignored++;
      continue;
    }
    try {
      await persist(db, {
        shopDomain: event.shopDomain,
        topic: event.topic,
        eventId: event.eventId,
        snapshot: event.payload,
      });
      recovered++;
    } catch {
      failed++;
    }
  }
  return { examined: events.length, recovered, failed, ignored };
}
