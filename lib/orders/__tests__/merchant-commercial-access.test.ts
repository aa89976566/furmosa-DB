import assert from 'node:assert/strict';
import test from 'node:test';
import {
  merchantCommercialModesAt,
  merchantProductAllowsMode,
} from '../merchant-commercial-access.ts';

test('legacy merchant types remain the fallback until any new module is configured', () => {
  assert.deepEqual(
    merchantCommercialModesAt([], ['consignment', 'wholesale']),
    ['consignment', 'wholesale'],
  );
});

test('configured modules are authoritative and respect their effective period', () => {
  const at = new Date('2026-09-24T12:00:00.000Z');
  assert.deepEqual(merchantCommercialModesAt([
    {
      mode: 'consignment',
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      effectiveUntil: null,
    },
    {
      mode: 'wholesale',
      effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
      effectiveUntil: null,
    },
    {
      mode: 'jar_exchange',
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      effectiveUntil: new Date('2026-09-01T00:00:00.000Z'),
    },
  ], ['consignment', 'wholesale', 'jar_exchange'], at), ['consignment']);
});

test('explicit SKU disable blocks its mode while legacy null stays compatible', () => {
  const legacyStandard = {
    productCategory: 'STANDARD',
    consignmentEnabled: null,
    wholesaleEnabled: null,
    jarExchangeEnabled: null,
  };
  assert.equal(merchantProductAllowsMode(legacyStandard, 'consignment'), true);
  assert.equal(merchantProductAllowsMode(legacyStandard, 'wholesale'), true);
  assert.equal(merchantProductAllowsMode({
    ...legacyStandard,
    consignmentEnabled: false,
  }, 'consignment'), false);
  assert.equal(merchantProductAllowsMode({
    ...legacyStandard,
    wholesaleEnabled: false,
  }, 'wholesale'), false);
});

test('product category and mode must agree even when the flag is enabled', () => {
  assert.equal(merchantProductAllowsMode({
    productCategory: 'JAR_EXCHANGE',
    consignmentEnabled: true,
    wholesaleEnabled: true,
    jarExchangeEnabled: true,
  }, 'consignment'), false);
  assert.equal(merchantProductAllowsMode({
    productCategory: 'JAR_EXCHANGE',
    consignmentEnabled: null,
    wholesaleEnabled: null,
    jarExchangeEnabled: true,
  }, 'jar_exchange'), true);
});
