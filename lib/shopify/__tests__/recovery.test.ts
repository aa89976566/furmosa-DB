import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { retryFailedShopifyIntakes } from '../recovery';
import { shopifySnapshot } from '../intake-policy';

describe('Shopify failed intake recovery', () => {
  it('replays valid failed inbox events and ignores malformed payloads', async () => {
    const updates: unknown[] = [];
    const valid = shopifySnapshot({ id: '1042', name: '#1042', created_at: '2026-10-19T00:00:00Z',
      updated_at: '2026-10-19T00:00:00Z', financial_status: 'paid', line_items: [] });
    const db = {
      shopifyWebhookEvent: {
        findMany: async () => [
          { id: 'valid', shopDomain: 'test.myshopify.com', topic: 'orders/create', eventId: 'e1', payload: valid },
          { id: 'bad', shopDomain: 'test.myshopify.com', topic: 'orders/create', eventId: 'e2', payload: null },
        ],
        update: async (args: unknown) => { updates.push(args); return args; },
      },
    } as unknown as PrismaClient;
    const replayed: unknown[] = [];
    const result = await retryFailedShopifyIntakes(db, 10, async (_client, event) => {
      replayed.push(event);
      return { created: true, disposition: 'saved' };
    });
    assert.deepEqual(result, { examined: 2, recovered: 1, failed: 0, ignored: 1 });
    assert.equal(replayed.length, 1);
    assert.deepEqual(updates, [{ where: { id: 'bad' }, data: {
      status: 'IGNORED', lastErrorCode: 'UNRECOVERABLE_PAYLOAD', nextAttemptAt: null,
    } }]);
  });

  it('leaves transient failures retryable', async () => {
    const snapshot = shopifySnapshot({ id: '1043', created_at: '2026-10-19T00:00:00Z',
      updated_at: '2026-10-19T00:00:00Z', line_items: [] });
    const db = { shopifyWebhookEvent: {
      findMany: async () => [{ id: 'valid', shopDomain: 'test.myshopify.com', topic: 'orders/updated', eventId: 'e1', payload: snapshot }],
      update: async () => { throw new Error('not expected'); },
    } } as unknown as PrismaClient;
    const result = await retryFailedShopifyIntakes(db, 10, async () => { throw new Error('temporary'); });
    assert.deepEqual(result, { examined: 1, recovered: 0, failed: 1, ignored: 0 });
  });
});
