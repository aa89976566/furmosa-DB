import test from 'node:test';
import assert from 'node:assert/strict';
import { completeReceiptMetadata } from '../complete-receipt-metadata';

test('metadata completion only updates metadata and writes before/after audit', async () => {
  const writes: any[] = [];
  const tx = {
    purchaseReceipt: {
      findUniqueOrThrow: async () => ({ id:'r', vendorId:null, receiptDate:null }),
      update: async (args: any) => writes.push(args),
    },
    vendor: { findFirst: async () => ({ id:'v' }) },
    purchaseReceiptMetadataChange: { create: async (args: any) => writes.push(args) },
  };
  await completeReceiptMetadata({ $transaction: async (fn: any) => fn(tx) } as any,
    { receiptId:'r',vendorId:'v',date:'2026-10-26',actorId:'u',actorName:'員工' });
  assert.equal(writes.length,2);
  assert.deepEqual(Object.keys(writes[0].data).sort(),['receiptDate','vendorId']);
  assert.deepEqual(writes[1].data.before,{vendorId:null,receiptDate:null});
  assert.equal(writes[1].data.actorId,'u');
});

test('existing metadata cannot be overwritten by completion', async () => {
  await assert.rejects(completeReceiptMetadata({ $transaction: async (fn: any) => fn({
    purchaseReceipt: { findUniqueOrThrow: async () => ({id:'r',vendorId:'original',receiptDate:null}) },
  }) } as any, {receiptId:'r',vendorId:'other',date:'',actorId:'u',actorName:'員工'}),/覆寫/);
});

test('empty completion reports unchanged without audit or update', async () => {
  const result = await completeReceiptMetadata({ $transaction: async (fn: any) => fn({
    purchaseReceipt: { findUniqueOrThrow: async () => ({id:'r',vendorId:null,receiptDate:null}) },
  }) } as any, {receiptId:'r',vendorId:'',date:'',actorId:'u',actorName:'員工'});
  assert.deepEqual(result,{changed:false});
});
