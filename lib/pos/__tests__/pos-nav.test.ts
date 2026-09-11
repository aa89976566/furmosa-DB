import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POS_NAV, activePosNavId } from '@/lib/pos/pos-nav';

describe('POS_NAV', () => {
  it('keeps four shared navigation destinations and existing route paths', () => {
    assert.deepEqual(
      POS_NAV.map((item) => item.label),
      ['首頁', '庫存', '紀錄', '對帳'],
    );
    assert.equal(POS_NAV[0]?.href, '/pos');
    assert.equal(POS_NAV[1]?.href, '/pos/stock');
    assert.equal(POS_NAV[2]?.href, '/pos/records');
    assert.equal(POS_NAV[3]?.href, '/pos/settle');
    assert.equal(activePosNavId('/pos'), 'home');
    assert.equal(activePosNavId('/pos/login'), null);
    assert.equal(activePosNavId('/pos/stock'), 'stock');
    assert.equal(activePosNavId('/pos/refill/abc'), null);
    assert.equal(activePosNavId('/pos/notifications'), null);
    assert.equal(activePosNavId('/pos/records'), 'records');
    assert.equal(activePosNavId('/pos/settle'), 'settle');
    assert.equal(activePosNavId('/pos/sell'), null);
    assert.equal(activePosNavId('/pos/restock'), null);
    assert.equal(activePosNavId('/pos/group-buy'), null);
    assert.equal(activePosNavId('/pos/stock/abc'), 'stock');
    assert.equal(activePosNavId('/pos/stocktaking'), null);
  });
});
