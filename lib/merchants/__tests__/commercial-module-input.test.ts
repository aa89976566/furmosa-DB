import assert from 'node:assert/strict';
import test from 'node:test';
import {
  merchantCommercialPeriodStatus,
  merchantCommercialPeriodsOverlap,
  parseMerchantCommercialMode,
  parseMerchantCommercialPeriod,
  validateMerchantCommercialPeriodWrite,
} from '../commercial-module-input.ts';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test('only the three approved merchant commercial modes are accepted', () => {
  assert.equal(parseMerchantCommercialMode('consignment'), 'consignment');
  assert.equal(parseMerchantCommercialMode('wholesale'), 'wholesale');
  assert.equal(parseMerchantCommercialMode('jar_exchange'), 'jar_exchange');
  assert.throws(() => parseMerchantCommercialMode('shipping'), /不正確/);
});

test('date-only input covers the full stop date and rejects reversed periods', () => {
  const parsed = parseMerchantCommercialPeriod(form({
    effectiveFrom: '2026-09-24',
    effectiveUntil: '2026-09-30',
  }));
  assert.equal(parsed.effectiveFrom.toISOString(), '2026-09-23T16:00:00.000Z');
  assert.equal(parsed.effectiveUntil?.toISOString(), '2026-09-30T15:59:59.999Z');
  assert.throws(
    () => parseMerchantCommercialPeriod(form({
      effectiveFrom: '2026-10-01',
      effectiveUntil: '2026-09-30',
    })),
    /不可早於/,
  );
});

test('same merchant and mode periods cannot overlap', () => {
  const first = {
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveUntil: new Date('2026-09-30T23:59:59.999Z'),
  };
  assert.equal(merchantCommercialPeriodsOverlap(first, {
    effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
    effectiveUntil: null,
  }), false);
  assert.equal(merchantCommercialPeriodsOverlap(first, {
    effectiveFrom: new Date('2026-09-30T00:00:00.000Z'),
    effectiveUntil: null,
  }), true);
});

test('status distinguishes upcoming, active and ended without changing other modes', () => {
  const now = new Date('2026-09-24T12:00:00.000Z');
  assert.equal(merchantCommercialPeriodStatus({
    effectiveFrom: new Date('2026-09-25T00:00:00.000Z'),
    effectiveUntil: null,
  }, now), 'upcoming');
  assert.equal(merchantCommercialPeriodStatus({
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveUntil: null,
  }, now), 'active');
  assert.equal(merchantCommercialPeriodStatus({
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveUntil: new Date('2026-09-23T23:59:59.999Z'),
  }, now), 'ended');
});

test('active and ended history cannot be rewritten retroactively', () => {
  const now = new Date('2026-09-24T12:00:00.000Z');
  assert.throws(() => validateMerchantCommercialPeriodWrite({
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveUntil: null,
  }, null, now), /過去日期/);
  assert.throws(() => validateMerchantCommercialPeriodWrite({
    effectiveFrom: new Date('2026-09-02T00:00:00.000Z'),
    effectiveUntil: null,
  }, {
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveUntil: null,
  }, now), /生效日不可修改/);
  assert.throws(() => validateMerchantCommercialPeriodWrite({
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveUntil: new Date('2026-09-20T23:59:59.999Z'),
  }, {
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveUntil: new Date('2026-09-20T23:59:59.999Z'),
  }, now), /已結束/);
});
