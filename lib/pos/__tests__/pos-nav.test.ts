import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POS_NAV, activePosNavId } from '@/lib/pos/pos-nav';

describe('POS_NAV', () => {
  it('keeps 收銀 as home and 今天 as a sibling', () => {
    assert.equal(POS_NAV[0]?.href, '/pos');
    assert.equal(POS_NAV[1]?.href, '/pos/today');
    assert.equal(activePosNavId('/pos'), 'sell');
    assert.equal(activePosNavId('/pos/today'), 'today');
    assert.equal(activePosNavId('/pos/appointments/abc'), 'today');
    assert.equal(activePosNavId('/pos/refill'), 'today');
    assert.equal(activePosNavId('/pos/restock/new'), 'restock');
  });
});
