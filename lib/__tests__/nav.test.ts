import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { navGroups } from '../nav';

describe('HQ 側欄', () => {
  it('營運任務在最上面，且含 UGC 審核', () => {
    assert.equal(navGroups[0]?.label, '營運任務');
    assert.deepEqual(
      navGroups[0]?.items.map((item) => ({ href: item.href, label: item.label })),
      [
        { href: '/tasks', label: '任務看板' },
        { href: '/campaigns/jiba-two-piece', label: 'UGC 審核' },
      ],
    );
  });

  it('不再顯示雞霸開箱審核', () => {
    const labels = navGroups.flatMap((group) => group.items.map((item) => item.label));
    assert.equal(labels.includes('雞霸開箱審核'), false);
    assert.equal(labels.includes('UGC 審核'), true);
  });

  it('訂單區有補貨申請入口，路徑為 /restock-requests', () => {
    const orderHub = navGroups.find((group) => group.label.startsWith('訂單'));
    const restock = orderHub?.items.find((item) => item.href === '/restock-requests');
    assert.equal(restock?.label, '補貨申請');
  });
});
