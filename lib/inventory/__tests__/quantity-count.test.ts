import assert from 'node:assert/strict';
import test from 'node:test';
import { countInventoryQuantities, type CountCommand } from '../quantity-count';
import { inventoryGroup, inventoryUnit, parseCountQuantity } from '../workbench';

const version = '2026-10-21T09:00:00.000Z';
const command = (): CountCommand => ({ eventKey: '643efc20-a4b7-423c-80b4-a6ab7a3ddaf0', actorId: 'staff', reason: '實體盤點',
  lines: [{ productId: 'bulk', quantity: 350, expectedVersion: version }, { productId: 'pack', quantity: 3, expectedVersion: version }] });
function database() {
  let state = { balances: [{ id: 'b1', productId: 'bulk', warehouseId: 'main', quantity: 400, unit: 'g', updatedAt: new Date(version) },
    { id: 'b2', productId: 'pack', warehouseId: 'main', quantity: 4, unit: '包', updatedAt: new Date(version) }], transactions: [] as any[], audits: [] as any[] };
  let role = 'warehouse';
  const products = [{ id: 'bulk', name: '散裝', unit: 'g', status: 'active', productCategory: 'STANDARD' },
    { id: 'pack', name: 'QiQi', unit: '包', status: 'active', productCategory: 'STANDARD' }];
  const db = { async $transaction(run: (tx: any) => Promise<any>) {
    const next = structuredClone(state);
    const result = await run({
      user: { findUnique: async () => ({ id: 'staff', name: '倉管', role }) },
      warehouse: { findUnique: async () => ({ id: 'main' }) },
      product: { findUnique: async ({ where }: any) => products.find(p => p.id === where.id), update: () => { throw Error('成本不得變更'); } },
      inventoryBalance: {
        findUnique: async ({ where }: any) => structuredClone(next.balances.find(b => b.productId === where.productId_warehouseId.productId)),
        updateMany: async ({ where, data }: any) => { const b = next.balances.find(b => b.id === where.id && b.updatedAt.getTime() === where.updatedAt.getTime());
          if (!b) return { count: 0 }; Object.assign(b, data, { updatedAt: new Date() }); return { count: 1 }; },
      },
      inventoryTransaction: {
        findMany: async () => next.transactions,
        create: async ({ data }: any) => { if (next.transactions.some(t => t.eventKey === data.eventKey)) throw Error('duplicate');
          const transaction = { ...data, id: `t${next.transactions.length}` }; next.transactions.push(transaction); return transaction; },
      },
      statusAuditLog: { create: async ({ data }: any) => next.audits.push(data) },
    });
    state = next; return result;
  } };
  return { db: db as any, state: () => state, setRole: (value: string) => { role = value; }, products };
}
test('units and categories never mix grams and vendor packs; quantities are strict integers', () => {
  assert.equal(inventoryUnit('公克'), 'g'); assert.equal(inventoryUnit('未知'), null);
  assert.equal(inventoryGroup({ unit: 'g', vendorId: 'qiqi' }), 'bulk');
  assert.equal(inventoryGroup({ unit: '包', vendorId: 'qiqi' }), 'vendor');
  assert.equal(parseCountQuantity('0'), 0);
  for (const invalid of ['', '-1', '1.5', '1e3', '2包', '2147483648', null]) assert.throws(() => parseCountQuantity(invalid));
});
test('batch commits quantities and automatic audit, with unit-preserving deltas and no cost writes', async () => {
  const d = database(); const c = command();
  assert.deepEqual(await countInventoryQuantities(d.db, c), { count: 2, alreadyApplied: false });
  assert.deepEqual(d.state().balances.map(b => b.quantity), [350, 3]);
  assert.deepEqual(d.state().transactions.map(t => [t.quantity, t.unit]), [[-50, 'g'], [-1, '包']]);
  assert.equal(d.state().audits.length, 2);
  assert.equal(d.state().audits[0].actorId, 'staff');
  assert.match(d.state().transactions[0].note, /400 → 350 g/);
  assert.ok(d.state().balances.every((b: any) => b.lastCountedAt instanceof Date));
  assert.deepEqual(await countInventoryQuantities(d.db, c), { count: 2, alreadyApplied: true });
  assert.equal(d.state().transactions.length, 2);
  await assert.rejects(countInventoryQuantities(d.db, { ...c, lines: [c.lines[1]] }), /識別碼/);
});
test('stale second line rolls back the entire batch including timestamps and audit', async () => {
  const d = database(); const c = command(); c.lines[1].expectedVersion = '2026-10-20T09:00:00.000Z';
  await assert.rejects(countInventoryQuantities(d.db, c), /已變更/);
  assert.deepEqual(d.state().balances.map(b => b.quantity), [400, 4]);
  assert.equal(d.state().transactions.length, 0); assert.equal(d.state().audits.length, 0);
});
test('unauthorized users, ambiguous units and duplicate product lines cannot write', async () => {
  const d = database(); d.setRole('sales'); await assert.rejects(countInventoryQuantities(d.db, command()), /權限/);
  d.setRole('warehouse'); d.products[1].unit = 'g'; await assert.rejects(countInventoryQuantities(d.db, command()), /單位尚未確認/);
  assert.equal(d.state().transactions.length, 0);
  const c = command(); c.lines.push(c.lines[0]); await assert.rejects(countInventoryQuantities(d.db, c), /無效/);
});
