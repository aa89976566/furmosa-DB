import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { storeHeading } from '@/lib/pos/store-display';

describe('storeHeading', () => {
  it('splits brand and branch from city without hardcoding 中和店', () => {
    const heading = storeHeading({ name: '泡泡堂', city: '中和' });
    assert.equal(heading.brandLine, '泡泡堂');
    assert.equal(heading.branchLine, '中和店');
    assert.equal(heading.combined, '泡泡堂 中和店');
  });

  it('strips a city already in the store name', () => {
    const heading = storeHeading({ name: '泡泡堂中和店', city: '中和' });
    assert.equal(heading.brandLine, '泡泡堂');
    assert.equal(heading.branchLine, '中和店');
  });

  it('keeps a single line when city is missing', () => {
    const heading = storeHeading({ name: '柒沐寵物', city: null });
    assert.equal(heading.brandLine, '柒沐寵物');
    assert.equal(heading.branchLine, null);
    assert.equal(heading.combined, '柒沐寵物');
  });
});
