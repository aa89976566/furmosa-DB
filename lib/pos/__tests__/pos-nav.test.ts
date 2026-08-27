import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POS_NAV, activePosNavId } from '@/lib/pos/pos-nav';

describe('POS_NAV', () => {
  it('keeps 收銀 as home and splits 叫貨 from 換罐', () => {
    assert.equal(POS_NAV[0]?.href, '/pos');
    assert.equal(POS_NAV[1]?.href, '/pos/today');
    assert.equal(POS_NAV[2]?.href, '/pos/restock');
    assert.equal(POS_NAV[3]?.href, '/pos/refill');
    assert.equal(activePosNavId('/pos'), 'sell');
    assert.equal(activePosNavId('/pos/today'), 'today');
    assert.equal(activePosNavId('/pos/appointments/abc'), 'today');
    assert.equal(activePosNavId('/pos/refill'), 'refill');
    assert.equal(activePosNavId('/pos/refill/abc'), 'refill');
    assert.equal(activePosNavId('/pos/restock'), 'restock');
    assert.equal(activePosNavId('/pos/restock/new'), 'refill');
    assert.equal(activePosNavId('/pos/restock/progress'), 'refill');
    assert.equal(activePosNavId('/pos/restock/req-1'), 'refill');
  });
});
