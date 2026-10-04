import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { effectiveProductTemperature } from '../effective-temperature';

describe('effectiveProductTemperature', () => {
  it('preserves explicit master-data temperature', () => {
    assert.equal(effectiveProductTemperature({ sourceSku: 'CK-05', defaultTemperature: 'frozen' }), 'frozen');
  });

  it('fills legacy chicken-fillet temperature only when unset', () => {
    assert.equal(effectiveProductTemperature({ sourceSku: 'CK-05', defaultTemperature: null }), 'ambient');
    assert.equal(effectiveProductTemperature({ sourceSku: 'ck-06', defaultTemperature: '' }), 'ambient');
  });

  it('does not guess unrelated legacy products', () => {
    assert.equal(effectiveProductTemperature({ sourceSku: 'FD-01', defaultTemperature: null }), '');
  });
});
