import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POS_NAV, activePosNavId } from '@/lib/pos/pos-nav';

describe('POS_NAV', () => {
  it('uses 結帳 庫存 換罐 補貨 查詢 and keeps 換罐 in the middle', () => {
    assert.deepEqual(
      POS_NAV.map((item) => item.label),
      ['結帳', '庫存', '換罐', '補貨', '查詢'],
    );
    assert.equal(POS_NAV[0]?.href, '/pos/sell');
    assert.equal(POS_NAV[1]?.href, '/pos/stock');
    assert.equal(POS_NAV[2]?.href, '/pos/refill');
    assert.equal(POS_NAV[3]?.href, '/pos/restock');
    assert.equal(POS_NAV[4]?.href, '/pos/records');
    assert.equal(activePosNavId('/pos'), null);
    assert.equal(activePosNavId('/pos/sell'), 'sell');
    assert.equal(activePosNavId('/pos/stock'), 'stock');
    assert.equal(activePosNavId('/pos/refill/abc'), 'refill');
    assert.equal(activePosNavId('/pos/restock/new'), 'restock');
    assert.equal(activePosNavId('/pos/records'), 'records');
  });
});
