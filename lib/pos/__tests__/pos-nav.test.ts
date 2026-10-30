import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { POS_NAV, activePosNavId } from '@/lib/pos/pos-nav';

describe('POS_NAV', () => {
  it('opens the shared sales entry from the first navigation destination', () => {
    assert.deepEqual(
      POS_NAV.map((item) => item.label),
      ['收銀', '庫存', '換罐', '美容券', '紀錄', '對帳'],
    );
    assert.equal(POS_NAV[0]?.href, '/pos/sell');
    assert.equal(POS_NAV[1]?.href, '/pos/stock');
    assert.equal(POS_NAV[2]?.href, '/pos/refill');
    assert.equal(POS_NAV[3]?.href, '/pos/coupons');
    assert.equal(POS_NAV[4]?.href, '/pos/records');
    assert.equal(POS_NAV[5]?.href, '/pos/settle');
    assert.equal(activePosNavId('/pos'), 'home');
    assert.equal(activePosNavId('/pos/login'), null);
    assert.equal(activePosNavId('/pos/stock'), 'stock');
    assert.equal(activePosNavId('/pos/refill'), 'refill');
    assert.equal(activePosNavId('/pos/refill/abc'), 'refill');
    assert.equal(activePosNavId('/pos/coupons'), 'coupons');
    assert.equal(activePosNavId('/pos/notifications'), null);
    assert.equal(activePosNavId('/pos/records'), 'records');
    assert.equal(activePosNavId('/pos/settle'), 'settle');
    assert.equal(activePosNavId('/pos/sell'), 'home');
    assert.equal(activePosNavId('/pos/restock'), null);
    assert.equal(activePosNavId('/pos/group-buy'), null);
    assert.equal(activePosNavId('/pos/stock/abc'), 'stock');
    assert.equal(activePosNavId('/pos/stocktaking'), null);
  });

  it('keeps jar exchange and coupon redemption as separate merchant tools', () => {
    const hub = readFileSync('app/pos/refill/page.tsx', 'utf8');
    const detail = readFileSync('app/pos/refill/[id]/page.tsx', 'utf8');
    const cooperationEntries = readFileSync('components/pos/cooperation-entries.tsx', 'utf8');

    assert.match(hub, /RefillWorkspace/);
    assert.match(hub, /requireMerchantSession/);
    assert.match(hub, /loadMerchantRefillDashboard/);
    assert.doesNotMatch(hub, /listMerchantRefillOrders/);
    assert.doesNotMatch(hub, /listMerchantJarExchangeMembers/);
    assert.match(detail, /redirect\('\/pos\/refill'\)/);
    assert.doesNotMatch(detail, /redirect\('\/pos\/coupons'\)/);
    assert.match(cooperationEntries, /href: '\/pos\/refill'/);
    assert.match(cooperationEntries, /href: '\/pos\/coupons'/);
    assert.match(cooperationEntries, /查看本店換罐內容、庫存與 LINE 交易紀錄/);
  });
});
