import assert from 'node:assert/strict';
import Module, { register } from 'node:module';
import { before, beforeEach, describe, it } from 'node:test';

const events = Array.from({ length: 8 }, (_, index) => ({
  id: `event-${index}`, title: '待收貨', statusLabel: '待驗收',
  href: `/pos/shipments/${index}`, occurredAt: new Date('2026-09-10T00:00:00Z'),
  actionRequired: true,
}));
let authenticated = true;
const requestedMerchants: string[] = [];
const mocks = {
  auth: { requireMerchantSession: async () => {
    if (!authenticated) throw new Error('POS_LOGIN_REQUIRED');
    return { merchantId: 'merchant-from-pos-session' };
  } },
  events: { loadMerchantEvents: async (merchantId: string) => {
    requestedMerchants.push(merchantId);
    return events;
  } },
};
(globalThis as typeof globalThis & { __POS_NOTIFICATION_MOCKS__: typeof mocks }).__POS_NOTIFICATION_MOCKS__ = mocks;
const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/merchant-auth') return mock('auth');
  if (specifier === '@/lib/pos/load-merchant-events') return mock('events');
  return nextResolve(specifier, context);
}
function mock(key) {
  const name = key === 'auth' ? 'requireMerchantSession' : 'loadMerchantEvents';
  return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export const ' + name + ' = globalThis.__POS_NOTIFICATION_MOCKS__.' + key + '.' + name + ';') };
}`;
register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
const moduleApi = Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown };
let loadRecentNotifications: typeof import('@/app/pos/notification-actions').loadRecentNotifications;
before(async () => {
  const original = moduleApi._load;
  moduleApi._load = function (request, parent, isMain) {
    if (request === '@/lib/merchant-auth' || /\/lib\/merchant-auth(?:\/index)?(?:\.ts)?$/.test(request)) return mocks.auth;
    if (request === '@/lib/pos/load-merchant-events' || /\/lib\/pos\/load-merchant-events(?:\.ts)?$/.test(request)) return mocks.events;
    return original.call(this, request, parent, isMain);
  };
  try { ({ loadRecentNotifications } = await import('@/app/pos/notification-actions')); }
  finally { moduleApi._load = original; }
});
beforeEach(() => { authenticated = true; requestedMerchants.length = 0; });
describe('notification preview access', () => {
  it('uses only the authenticated merchant and leaves task state unchanged', async () => {
    const beforeEvents = structuredClone(events);
    const result = await loadRecentNotifications();
    assert.deepEqual(requestedMerchants, ['merchant-from-pos-session']);
    assert.equal(result.length, 5);
    assert.equal(result[0].occurredAt, '2026-09-10T00:00:00.000Z');
    assert.deepEqual(events, beforeEvents);
    assert.equal('actionRequired' in result[0], false);
  });
  it('does not load merchant events without a POS session', async () => {
    authenticated = false;
    await assert.rejects(loadRecentNotifications, /POS_LOGIN_REQUIRED/);
    assert.deepEqual(requestedMerchants, []);
  });
});
