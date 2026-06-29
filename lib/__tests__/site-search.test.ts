import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePhoneDigits,
  orderSearchWhere,
  phoneSearchVariants,
} from '../site-search';

test('normalizePhoneDigits strips formatting', () => {
  assert.equal(normalizePhoneDigits('0983-929-775'), '0983929775');
});

test('phoneSearchVariants includes with and without leading zero', () => {
  const variants = phoneSearchVariants('983929775');
  assert.ok(variants.includes('983929775'));
  assert.ok(variants.includes('0983929775'));
});

test('orderSearchWhere matches shipment recipient and merchant contact', () => {
  const where = orderSearchWhere('0983929775');
  assert.ok(where?.OR);
  const json = JSON.stringify(where);
  assert.match(json, /recipientPhone/);
  assert.match(json, /merchant/);
});

test('orderSearchWhere matches merchant name partial', () => {
  const where = orderSearchWhere('墨菲');
  assert.ok(where?.OR);
  assert.match(JSON.stringify(where), /merchant/);
});
