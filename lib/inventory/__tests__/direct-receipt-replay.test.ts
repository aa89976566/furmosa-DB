import test from 'node:test';
import assert from 'node:assert/strict';
import { postPurchaseReceipt, type PostPurchaseReceiptInput } from '../post-purchase-receipt';

const input: PostPurchaseReceiptInput = {
  submissionKey: '11111111-1111-4111-8111-111111111111',
  vendorId: null, warehouseId: 'warehouse', supplierDocumentNumber: null,
  receiptDate: new Date('2026-10-26T04:00:00Z'), createdById: 'staff', note: null,
  shippingCostCents: 0, packagingCostCents: 0, processingCostCents: 0,
  taxAmountCents: 0, discountAmountCents: 0,
  items: [{ productId: 'product', quantityGrams: 100, rawAmountCents: 100 }], attachments: [],
};

test('direct receipt requires a submission key before any database access', async () => {
  await assert.rejects(postPurchaseReceipt({} as any, { ...input, submissionKey: undefined }), /重新開啟/);
});

test('a conflicting replay is rejected before inventory writes', async () => {
  let saved: any;
  const db = { $transaction: async (fn: any) => fn({
    purchaseReceipt: { findUnique: async () => saved, create: async ({ data }: any) => { saved = { id: 'receipt', ...data }; return saved; } },
    product: { findMany: async () => [] },
  }) } as any;
  // Capture the server-computed fingerprint without allowing any inventory write.
  db.$transaction = async (fn: any) => fn({ purchaseReceipt: { findUnique: async () => saved }, product: {
    findMany: async () => { throw new Error('stop before write'); },
  } });
  await assert.rejects(postPurchaseReceipt(db, input), /stop before write/);
  saved = { id: 'existing', submissionHash: 'different' };
  await assert.rejects(postPurchaseReceipt(db, input), /內容不同/);
});
