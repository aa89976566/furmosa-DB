import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { loadRecentNotificationsForSession } from '../notification-action-service.ts';

const events = Array.from({ length: 8 }, (_, index) => ({
  id: `event-${index}`,
  title: '待收貨',
  statusLabel: '待驗收',
  href: `/pos/shipments/${index}`,
  occurredAt: new Date('2026-09-10T00:00:00Z'),
  actionRequired: true,
}));
let authenticated = true;
const requestedMerchants: string[] = [];

const deps = {
  requireMerchantSession: async () => {
    if (!authenticated) throw new Error('POS_LOGIN_REQUIRED');
    return { merchantId: 'merchant-from-pos-session' };
  },
  loadMerchantEventPreviews: async (merchantId: string, limit: number) => {
    requestedMerchants.push(`${merchantId}:${limit}`);
    return events;
  },
};

beforeEach(() => {
  authenticated = true;
  requestedMerchants.length = 0;
});

describe('notification preview access', () => {
  it('uses only the authenticated merchant and leaves task state unchanged', async () => {
    const beforeEvents = structuredClone(events);
    const result = await loadRecentNotificationsForSession(deps);
    assert.deepEqual(requestedMerchants, ['merchant-from-pos-session:5']);
    assert.equal(result.length, 5);
    assert.equal(result[0]?.occurredAt, '2026-09-10T00:00:00.000Z');
    assert.deepEqual(events, beforeEvents);
    assert.equal('actionRequired' in result[0]!, false);
  });

  it('does not load merchant events without a POS session', async () => {
    authenticated = false;
    await assert.rejects(() => loadRecentNotificationsForSession(deps), /POS_LOGIN_REQUIRED/);
    assert.deepEqual(requestedMerchants, []);
  });
});
