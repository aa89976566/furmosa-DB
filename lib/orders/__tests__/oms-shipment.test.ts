import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOmsShipmentActionable,
  omsStatusForShipmentStatus,
  omsStatusLabel,
} from '../oms';

test('OMS shipment controls stay hidden until review creates the shipment', () => {
  for (const status of ['NEW', 'REVIEW', 'READY']) {
    assert.equal(isOmsShipmentActionable(status), false);
  }
  assert.equal(isOmsShipmentActionable('FULFILLMENT_PENDING'), true);
  assert.equal(isOmsShipmentActionable('FULFILLED'), true);
  assert.equal(isOmsShipmentActionable(null), false);
});

test('shipment handoff updates the OMS work state', () => {
  assert.equal(omsStatusForShipmentStatus('pending'), 'FULFILLMENT_PENDING');
  assert.equal(omsStatusForShipmentStatus('packed'), 'FULFILLMENT_PENDING');
  assert.equal(omsStatusForShipmentStatus('shipped'), 'FULFILLED');
  assert.equal(omsStatusForShipmentStatus('delivered'), 'FULFILLED');
  assert.equal(omsStatusForShipmentStatus('cancelled'), null);
});

test('OMS shipment gate has an operator-facing label', () => {
  assert.equal(omsStatusLabel('REVIEW'), '待審核');
  assert.equal(omsStatusLabel('unexpected'), 'OMS 訂單');
});
