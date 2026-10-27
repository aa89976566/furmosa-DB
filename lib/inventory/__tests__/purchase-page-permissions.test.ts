import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const React = require('react');
Object.assign(globalThis, { React });
const { renderToStaticMarkup } = require('react-dom/server');
let role: string | null = null;
let reads = 0;
const database = { findMany: async () => { reads++; return []; } };
const internal = Module as typeof Module & { _load: (...args: any[]) => any };
const original = internal._load.bind(Module);
internal._load = (request, ...rest) => {
  if (request === '@/lib/auth') return { getCurrentUser: async () => role ? { role } : null };
  if (request === '@/lib/prisma') return { prisma: { vendor: database, warehouse: database, product: database } };
  if (request === './purchase-receipt-form') return { PurchaseReceiptForm: ({ children }: any) => React.createElement('div', null, children) };
  if (request === '../actions') return { createPendingPurchaseOrder: async () => {} };
  return original(request, ...rest);
};
const receipt = require('../../../app/(main)/inventory/purchases/new/page').default;
const purchaseOrder = require('../../../app/(main)/inventory/purchase-orders/new/page').default;
internal._load = original;

test('purchase entry pages reject unauthorized roles before loading form data', async () => {
  for (const page of [receipt, purchaseOrder]) {
    for (role of [null, 'sales', 'viewer']) {
      reads = 0;
      const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
      assert.equal(reads, 0);
      assert.match(html, /目前帳號沒有新增進貨權限/);
      assert.ok(!html.includes('<form'));
    }
    for (role of ['admin', 'warehouse', 'finance']) {
      reads = 0;
      await page({ searchParams: Promise.resolve({}) });
      assert.equal(reads, 3);
    }
  }
});
