import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { financeNavGroup, navGroups, navGroupsForRole } from '../nav';

describe('HQ 側欄', () => {
  it('每天工作在最上面，只放高頻入口', () => {
    assert.equal(navGroups[0]?.label, '每天工作');
    assert.deepEqual(
      navGroups[0]?.items.map((item) => ({ href: item.href, label: item.label })),
      [
        { href: '/dashboard', label: '首頁' },
        { href: '/reviews', label: '待審核' },
        { href: '/orders', label: '訂單' },
        { href: '/shipments?status=pending', label: '出貨' },
        { href: '/tasks', label: '任務' },
      ],
    );
  });

  it('低使用率的訂閱制預設為可收合群組', () => {
    const subscriptions = navGroups.find((group) => group.label === '訂閱制');
    assert.equal(subscriptions?.collapsible, true);
    assert.equal(subscriptions?.items.length, 3);
  });

  it('不再顯示雞霸開箱審核或獨立的 UGC 審核選單', () => {
    const labels = navGroups.flatMap((group) => group.items.map((item) => item.label));
    assert.equal(labels.includes('雞霸開箱審核'), false);
    assert.equal(labels.includes('UGC 審核'), false);
    assert.equal(labels.includes('待審核'), true);
  });

  it('合作通路總覽用店家，不用寄賣當全體總稱', () => {
    const storeGroup = navGroups.find((group) => group.label === '店家與供應');
    const merchants = storeGroup?.items.find((item) => item.href === '/merchants');
    assert.equal(merchants?.label, '店家');
  });

  it('財務入口只加在最高權限管理員的導覽', () => {
    const staffLabels = navGroupsForRole('staff').flatMap((group) => group.items.map((item) => item.label));
    assert.equal(staffLabels.includes('13 週現金流'), false);
    assert.equal(navGroups.some((group) => group.label === '財務'), false);
    const admin = navGroupsForRole('admin');
    assert.equal(admin.at(-1)?.label, '財務');
    assert.deepEqual(
      financeNavGroup.items.map((item) => item.href),
      ['/finance/products', '/finance/channels', '/finance/partners', '/finance/cash-flow'],
    );
  });
});
