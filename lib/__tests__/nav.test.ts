import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { navGroups } from '../nav';

describe('HQ 側欄', () => {
  it('工作台在最上面，只放高頻入口', () => {
    assert.equal(navGroups[0]?.label, '工作台');
    assert.deepEqual(
      navGroups[0]?.items.map((item) => ({ href: item.href, label: item.label })),
      [
        { href: '/dashboard', label: '我的工作台' },
        { href: '/reviews', label: '待審核' },
        { href: '/orders', label: '訂單' },
        { href: '/shipments?status=pending', label: '出貨' },
        { href: '/tasks', label: '任務' },
      ],
    );
  });

  it('低使用率的訂閱與計畫預設為可收合群組', () => {
    const subscriptions = navGroups.find((group) => group.label === '訂閱與計畫');
    assert.equal(subscriptions?.collapsible, true);
    assert.equal(subscriptions?.items.length, 4);
  });

  it('不再顯示雞霸開箱審核或獨立的 UGC 審核選單', () => {
    const labels = navGroups.flatMap((group) => group.items.map((item) => item.label));
    assert.equal(labels.includes('雞霸開箱審核'), false);
    assert.equal(labels.includes('UGC 審核'), false);
    assert.equal(labels.includes('待審核'), true);
  });

  it('合作通路總覽用店家，不用寄賣當全體總稱', () => {
    const storeGroup = navGroups.find((group) => group.label === '客戶與通路');
    const merchants = storeGroup?.items.find((item) => item.href === '/merchants');
    assert.equal(merchants?.label, '店家');
  });
});
