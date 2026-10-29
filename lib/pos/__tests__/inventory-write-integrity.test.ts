import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const load = (Module as any)._load.bind(Module);
let isolation: unknown;
let writes: any[] = [];
let failAudit = false;
const tx = {
  product: { findUnique: async () => ({ id: 'p', name: '鴨肺', priceTiers: [{ id: '30' }, { id: '50' }] }) },
  merchantStock: {
    findMany: async () => [{ id: 'a', tierId: '30', quantity: 3 }, { id: 'b', tierId: '50', quantity: 2 }],
    upsert: async (args: any) => { writes.push(args); },
    updateMany: async () => ({ count: 1 }),
    findFirstOrThrow: async () => ({ quantity: 3 }),
  },
  merchantStockTxn: { create: async (args: any) => { if (failAudit) throw new Error('audit unavailable'); writes.push(args); } },
};
const prisma = { $transaction: async (fn: any, options: any) => {
  isolation = options?.isolationLevel;
  const before = [...writes];
  try { return await fn(tx); } catch (e) { writes = before; throw e; }
} };
(Module as any)._load = (request: string, ...args: any[]) => {
  if (request.endsWith('/prisma')) return { prisma };
  if (request.includes('merchant-stock-txn-number')) return { nextStockTxnNumber: async () => 'ADJ', reserveStockTxnNumbers: async () => ['SALE'] };
  if (request.endsWith('/pos/counter-catalog')) return { loadCounterCatalog: async () => ({ priced: [{ productId: 'p', tierId: '50', name: '鴨肺', price: 90, priceTiers: [{ price: 90 }, { price: 150 }], unitPrice: 150, suggestedPrice: 90, commissionMode: 'percent', commissionValue: 20, stock: 10 }] }) };
  return load(request, ...args);
};
const { adjustStoreProductQuantity } = require('../adjust-store-stock');
const { recordCounterSale } = require('../record-counter-sale');

test('盤點逐規格寫入，同交易建立流水；流水失敗則不保留庫存修改', async () => {
  writes = [];
  const result = await adjustStoreProductQuantity({ merchantId: 'm', productId: 'p', tierId: '50', newQuantity: 4 });
  assert.equal(isolation, 'Serializable');
  assert.equal(result.quantity, 7);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].where.merchantId_productId_tierId.tierId, '50');
  assert.equal(writes[1].data.balanceAfter, 7);
  failAudit = true;
  const before = [...writes];
  await assert.rejects(adjustStoreProductQuantity({ merchantId: 'm', productId: 'p', tierId: '50', newQuantity: 5 }), /audit unavailable/);
  assert.deepEqual(writes, before);
  failAudit = false;
});

test('收銀流水使用扣庫存後實際餘額，而非舊目錄估算', async () => {
  writes = [];
  await recordCounterSale('m', [{ productId: 'p', tierId: '50', qty: 1 }]);
  assert.equal(writes[0].data.balanceAfter, 3);
  assert.equal(writes[0].data.unitPrice, 150);
});
