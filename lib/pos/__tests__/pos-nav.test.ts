import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POS_NAV, activePosNavId } from '@/lib/pos/pos-nav';

describe('POS_NAV', () => {
  it('uses 首頁 庫存 換罐 查詢 結帳 and puts 結帳 last', () => {
    assert.deepEqual(
      POS_NAV.map((item) => item.label),
      ['首頁', '庫存', '換罐', '查詢', '結帳'],
    );
    assert.equal(POS_NAV[0]?.href, '/pos');
    assert.equal(POS_NAV[1]?.href, '/pos/stock');
    assert.equal(POS_NAV[2]?.href, '/pos/refill');
    assert.equal(POS_NAV[3]?.href, '/pos/records');
    assert.equal(POS_NAV[4]?.href, '/pos/settle');
    assert.equal(activePosNavId('/pos'), 'home');
    assert.equal(activePosNavId('/pos/login'), null);
    assert.equal(activePosNavId('/pos/stock'), 'stock');
    assert.equal(activePosNavId('/pos/refill/abc'), 'refill');
    assert.equal(activePosNavId('/pos/records'), 'records');
    assert.equal(activePosNavId('/pos/settle'), 'settle');
    assert.equal(activePosNavId('/pos/sell'), null);
    assert.equal(activePosNavId('/pos/restock'), 'refill');
    assert.equal(activePosNavId('/pos/restock/request-1'), 'refill');
  });
});
