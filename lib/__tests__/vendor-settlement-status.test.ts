import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertVendorSettlementTransition,
  vendorSettlementNextActions,
  vendorSettlementPaymentReference,
} from '../vendor-settlement-status';

test('工作人員可送交核對，但不能確認或付款', () => {
  assert.deepEqual(assertVendorSettlementTransition({
    current: 'draft', next: 'reviewing', actorRole: 'staff',
  }), { current: 'draft', next: 'reviewing' });
  assert.throws(() => assertVendorSettlementTransition({
    current: 'reviewing', next: 'approved', actorRole: 'staff',
  }));
  assert.deepEqual(vendorSettlementNextActions('reviewing', 'staff'), ['draft']);
});

test('管理員可確認、退回與標記付款', () => {
  assert.deepEqual(vendorSettlementNextActions('reviewing', 'admin'), ['draft', 'approved']);
  assert.deepEqual(vendorSettlementNextActions('approved', 'admin'), ['reviewing', 'paid']);
});

test('已付款為終態，且禁止跳過核對流程', () => {
  assert.deepEqual(vendorSettlementNextActions('paid', 'admin'), []);
  assert.throws(() => assertVendorSettlementTransition({
    current: 'draft', next: 'paid', actorRole: 'admin',
  }));
});

test('標記付款必須留下憑證，其他狀態不寫入付款註記', () => {
  assert.equal(vendorSettlementPaymentReference('paid', '  轉帳末五碼 12345  '), '轉帳末五碼 12345');
  assert.equal(vendorSettlementPaymentReference('approved', ''), null);
  assert.throws(() => vendorSettlementPaymentReference('paid', ''));
  assert.throws(() => vendorSettlementPaymentReference('paid', 'a'.repeat(201)));
});
