import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmInventoryUnit, type UnitConfirmation } from '../confirm-unit';

const version = '2026-10-21T09:00:00.000Z';
const command = (): UnitConfirmation => ({ eventKey: '643efc20-a4b7-423c-80b4-a6ab7a3ddaf0',
  actorId: 'admin', productId: 'quail', quantity: 5, unit: '隻', expectedVersion: version,
  expectedProductVersion: version, reason: 'Google Sheet 庫存第12列：5隻' });
function fixture() {
  let state: any = { balances: [{ id: 'b1', productId: 'quail', warehouseId: 'main',
    quantity: 5, unit: 'g', updatedAt: new Date(version) }], transactions: [], audits: [] };
  let role = 'admin';
  let failUpdate = false;
  const product = { id: 'quail', status: 'active', productCategory: 'STANDARD', unit: '隻', updatedAt: new Date(version) };
  const db: any = { async $transaction(run: any) {
    const next = structuredClone(state);
    const result = await run({
      user: { findUnique: async () => ({ role, name: '管理員' }) },
      product: { findUnique: async () => product },
      warehouse: { findUnique: async () => ({ id: 'main' }) },
      inventoryBalance: {
        findMany: async () => next.balances,
        updateMany: async ({ where, data }: any) => {
          if (failUpdate) return { count: 0 };
          const b = next.balances.find((b: any) => b.id === where.id && b.updatedAt.getTime() === where.updatedAt.getTime());
          if (!b) return { count: 0 }; Object.assign(b, data, { updatedAt: new Date() }); return { count: 1 };
        },
        create: async ({ data }: any) => next.balances.push({ id: 'new', ...data, updatedAt: new Date() }),
      },
      inventoryTransaction: {
        findUnique: async ({ where }: any) => next.transactions.find((t: any) => t.eventKey === where.eventKey),
        create: async ({ data }: any) => { const t = { id: String(next.transactions.length), ...data }; next.transactions.push(t); return t; },
      },
      statusAuditLog: { create: async ({ data }: any) => next.audits.push(data) },
    });
    state = next; return result;
  } };
  return { db, state: () => state, role: (r: string) => { role = r; }, failUpdate: () => { failUpdate = true; }, product };
}
test('unit correction closes old grams and opens explicitly counted pieces, preserving audit and retry safety', async () => {
  const d = fixture(); const c = command();
  assert.deepEqual(await confirmInventoryUnit(d.db, c), { alreadyApplied: false });
  assert.deepEqual(d.state().transactions.map((t: any) => [t.quantity, t.unit]), [[-5, 'g'], [5, '隻']]);
  assert.equal(d.state().balances[0].unit, '隻'); assert.equal(d.state().balances[0].quantity, 5);
  assert.equal(d.state().audits.length, 1);
  assert.deepEqual(await confirmInventoryUnit(d.db, c), { alreadyApplied: true });
  assert.equal(d.state().transactions.length, 2);
  await assert.rejects(confirmInventoryUnit(d.db, { ...c, quantity: 6 }), /識別碼/);
});
test('missing balance can be initialized in the confirmed master unit, including a real zero count', async () => {
  const d = fixture(); d.state().balances = [];
  await confirmInventoryUnit(d.db, { ...command(), quantity: 0, expectedVersion: null });
  assert.equal(d.state().balances[0].quantity, 0); assert.equal(d.state().balances[0].unit, '隻');
  assert.equal(d.state().transactions.length, 1);
});
test('non-admin, stale quantity/product, other-warehouse stock, unsupported units and non-standard products cannot write', async () => {
  const d = fixture(); d.role('warehouse'); await assert.rejects(confirmInventoryUnit(d.db, command()), /管理員/);
  d.role('admin'); await assert.rejects(confirmInventoryUnit(d.db, { ...command(), expectedVersion: null }), /庫存已變更/);
  await assert.rejects(confirmInventoryUnit(d.db, { ...command(), expectedProductVersion: '2026-10-20' }), /商品設定/);
  await assert.rejects(confirmInventoryUnit(d.db, { ...command(), unit: '包' }), /商品設定/);
  await assert.rejects(confirmInventoryUnit(d.db, { ...command(), quantity: -1 }), /無效/);
  d.state().balances.push({ warehouseId: 'other', quantity: 1 });
  await assert.rejects(confirmInventoryUnit(d.db, command()), /其他倉庫/); d.state().balances.pop();
  d.product.productCategory = 'JAR_EXCHANGE'; await assert.rejects(confirmInventoryUnit(d.db, command()), /不適用/);
  assert.equal(d.state().transactions.length, 0); assert.equal(d.state().audits.length, 0);
});
test('already matching units use normal stocktake; a failing balance update rolls back both ledger entries', async () => {
  const d = fixture(); d.state().balances[0].unit = '隻';
  await assert.rejects(confirmInventoryUnit(d.db, command()), /一般盤點/);
  d.state().balances[0].unit = 'g'; d.failUpdate();
  await assert.rejects(confirmInventoryUnit(d.db, command()), /庫存已變更/);
  assert.equal(d.state().transactions.length, 0); assert.equal(d.state().audits.length, 0);
  d.state().balances[0].quantity = -2147483648;
  await assert.rejects(confirmInventoryUnit(d.db, command()), /超過/);
  assert.equal(d.state().transactions.length, 0);
});
