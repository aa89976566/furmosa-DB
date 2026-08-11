import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MORNING_DASHBOARD_DEFAULT_TAB,
  MORNING_DASHBOARD_TABS,
  morningDashboardHref,
  parseMorningDashboardTab,
} from '@/lib/line/morning/hq/tabs';

describe('4B-D tab contract', () => {
  it('無 param／today => 今日早安', () => {
    assert.equal(parseMorningDashboardTab(undefined), 'today');
    assert.equal(parseMorningDashboardTab(null), 'today');
    assert.equal(parseMorningDashboardTab('today'), 'today');
    assert.equal(MORNING_DASHBOARD_DEFAULT_TAB, 'today');
  });

  it('合法 tab 對應', () => {
    assert.equal(parseMorningDashboardTab('content'), 'content');
    assert.equal(parseMorningDashboardTab('preferences'), 'preferences');
    assert.equal(parseMorningDashboardTab('system'), 'system');
  });

  it('未知、空、大小寫不符、陣列重複 => today，不 throw', () => {
    assert.equal(parseMorningDashboardTab(''), 'today');
    assert.equal(parseMorningDashboardTab('   '), 'today');
    assert.equal(parseMorningDashboardTab('TODAY'), 'today');
    assert.equal(parseMorningDashboardTab('Content'), 'today');
    assert.equal(parseMorningDashboardTab('nope'), 'today');
    assert.equal(parseMorningDashboardTab(['content', 'system']), 'content');
    assert.equal(parseMorningDashboardTab([]), 'today');
  });

  it('href deep link：today 無 query；其他帶 tab=', () => {
    assert.equal(morningDashboardHref('today'), '/campaigns/line-morning');
    assert.equal(
      morningDashboardHref('content'),
      '/campaigns/line-morning?tab=content',
    );
    assert.equal(
      morningDashboardHref('preferences'),
      '/campaigns/line-morning?tab=preferences',
    );
    assert.equal(
      morningDashboardHref('system'),
      '/campaigns/line-morning?tab=system',
    );
  });

  it('四區固定順序', () => {
    assert.deepEqual([...MORNING_DASHBOARD_TABS], [
      'today',
      'content',
      'preferences',
      'system',
    ]);
  });
});
