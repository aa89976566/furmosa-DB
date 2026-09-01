import assert from 'node:assert/strict';
import test from 'node:test';
import { maskLineUserId, resolvePetAgeYears } from '../member-display';

test('LINE user id is masked while retaining enough characters for identification', () => {
  assert.equal(maskLineUserId('Ueb6e10488b6e15c9015579fdd00cf9fd'), 'Ueb6e104…f9fd');
  assert.equal(maskLineUserId(null), null);
});

test('pet age is derived from birthday when explicit age is missing', () => {
  assert.equal(
    resolvePetAgeYears(null, new Date('2022-02-02T00:00:00.000Z'), new Date('2026-09-01T00:00:00.000Z')),
    4,
  );
});

test('explicit pet age remains authoritative', () => {
  assert.equal(
    resolvePetAgeYears(7, new Date('2022-02-02T00:00:00.000Z'), new Date('2026-09-01T00:00:00.000Z')),
    7,
  );
});
