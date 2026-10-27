import assert from 'node:assert/strict';
import test from 'node:test';
import { supplierConsignmentSnapshot } from '../vendor-consignment-snapshot';

test('freezes an enabled supplier share on the order item', () => {
  assert.deepEqual(
    supplierConsignmentSnapshot({
      id: 'qiqi',
      supplierConsignmentEnabled: true,
      furmosaShareBps: 2_500,
    }),
    {
      supplierVendorIdSnapshot: 'qiqi',
      supplierFurmosaShareBpsSnapshot: 2_500,
    },
  );
});

test('does not enroll an ordinary supplier or an incomplete rule', () => {
  assert.deepEqual(
    supplierConsignmentSnapshot({
      id: 'ordinary',
      supplierConsignmentEnabled: false,
      furmosaShareBps: 2_500,
    }),
    {
      supplierVendorIdSnapshot: null,
      supplierFurmosaShareBpsSnapshot: null,
    },
  );
  assert.deepEqual(
    supplierConsignmentSnapshot({
      id: 'incomplete',
      supplierConsignmentEnabled: true,
      furmosaShareBps: null,
    }),
    {
      supplierVendorIdSnapshot: null,
      supplierFurmosaShareBpsSnapshot: null,
    },
  );
});

test('rejects an out-of-range supplier share instead of snapshotting bad terms', () => {
  assert.deepEqual(
    supplierConsignmentSnapshot({
      id: 'bad',
      supplierConsignmentEnabled: true,
      furmosaShareBps: 10_001,
    }),
    {
      supplierVendorIdSnapshot: null,
      supplierFurmosaShareBpsSnapshot: null,
    },
  );
});
