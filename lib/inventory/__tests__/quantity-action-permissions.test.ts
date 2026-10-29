import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
let role: string | null = null;
const commands: Array<{ actorId: string; lines: Array<{ quantity: number }> }> = [];
const internal = Module as typeof Module & { _load: (...args: any[]) => any };
const original = internal._load.bind(Module);
internal._load = (request, ...rest) => {
  if (request === '@/lib/auth') return { getCurrentUser: async () => role ? { role, userId: 'session-staff' } : null };
  if (request === '@/lib/prisma') return { prisma: {} };
  if (request === '@/lib/inventory/quantity-count') return {
    QuantityCountError: class extends Error {},
    countInventoryQuantities: async (_db: unknown, command: typeof commands[number]) => { commands.push(command); return { count: 1 }; },
  };
  if (request === '@/lib/inventory/refresh-views') return { refreshInventoryViews: async () => {} };
  return original(request, ...rest);
};
const { saveInventoryQuantities } = require('../../../app/(main)/inventory/quantity-actions');
internal._load = original;
function data(quantity = '350') {
  const form = new FormData();
  form.set('eventKey', '6c7ac741-0179-4d47-bb3a-812c561d831a');
  form.set('actorId', 'forged-admin');
  form.set('reason', '例行盤點');
  form.set('lines', JSON.stringify([{ productId: 'p1', quantity, expectedVersion: null }]));
  return form;
}

test('inventory write action rejects read-only roles before any write and uses authenticated actor', async () => {
  for (role of [null, 'sales', 'viewer']) {
    const result = await saveInventoryQuantities(data());
    assert.equal(result.ok, false);
    assert.match(result.message, /沒有更新庫存權限/);
  }
  assert.equal(commands.length, 0);
  for (role of ['admin', 'warehouse', 'finance', 'inventory_reviewer']) {
    assert.equal((await saveInventoryQuantities(data())).ok, true);
    assert.equal(commands.at(-1)!.actorId, 'session-staff');
    assert.equal(commands.at(-1)!.lines[0].quantity, 350);
  }
  const before = commands.length;
  assert.equal((await saveInventoryQuantities(data('-1'))).ok, false);
  assert.equal(commands.length, before);
});
