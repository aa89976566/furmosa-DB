import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  JAR_WEEK_ACTIVITY_PREVIEW_LIMIT,
  jarActivityStoreName,
  presentJarWeekActivity,
  type JarWeekActivityEntry,
} from '@/lib/jar-exchange/week-activity';

const reference = new Date('2026-10-09T11:04:00.000Z');

function entry(partial: Partial<JarWeekActivityEntry> & Pick<JarWeekActivityEntry, 'id' | 'createdAt'>): JarWeekActivityEntry {
  return {
    customerId: 'customer-yun',
    memberName: 'YUN',
    pointsChange: 1,
    sourceType: 'jar_code_redeem',
    storeName: null,
    ...partial,
  };
}

describe('weekly jar activity', () => {
  it('shows YUN at Taipei 17:28 and does not treat UTC+2 11:28 as Taiwan time', () => {
    const view = presentJarWeekActivity(
      [
        entry({
          id: 'yun-ledger',
          createdAt: new Date('2026-10-09T09:28:25.731Z'),
          storeName: null,
        }),
      ],
      reference,
    );

    assert.equal(view.rows[0]?.timeLabel, '2026/10/09 17:28');
    assert.notEqual(view.rows[0]?.timeLabel, '2026/10/09 11:28');
    assert.equal(view.rows[0]?.storeName, null);
    assert.equal(view.rows[0]?.pointsChange, 1);
    assert.equal(view.rows[0]?.exchangeCount, 1);
    assert.equal(view.totalExchanges, 1);
    assert.equal(view.participantCount, 1);
  });

  it('counts ledger events in the seven-day window, not points or a lifetime total', () => {
    const view = presentJarWeekActivity(
      [
        entry({
          id: 'older',
          createdAt: new Date('2026-10-02T15:00:00.000Z'),
          customerId: 'outside',
          memberName: '窗外',
          pointsChange: 99,
        }),
        entry({
          id: 'hsuan',
          createdAt: new Date('2026-10-04T10:15:27.924Z'),
          customerId: 'customer-hsuan',
          memberName: 'Hsuan',
          pointsChange: 1,
        }),
        entry({
          id: 'yun-a',
          createdAt: new Date('2026-10-09T09:28:25.731Z'),
          pointsChange: 1,
        }),
        entry({
          id: 'yun-b',
          createdAt: new Date('2026-10-08T01:00:00.000Z'),
          pointsChange: 3,
          sourceType: 'refill_completed',
          storeName: '合作店甲',
        }),
        entry({
          id: 'manual',
          createdAt: new Date('2026-10-09T02:00:00.000Z'),
          sourceType: 'manual_adjustment',
          pointsChange: 20,
        }),
      ],
      reference,
    );

    assert.equal(view.totalExchanges, 3);
    assert.equal(view.participantCount, 2);
    assert.deepEqual(
      view.rows.map((row) => row.id),
      ['yun-a', 'yun-b', 'hsuan'],
    );
    assert.equal(view.rows[1]?.storeName, '合作店甲');
    assert.equal(view.rangeLabel, '2026/10/03–2026/10/09');
  });

  it('keeps the eight newest rows and still counts every event', () => {
    const entries = Array.from({ length: 9 }, (_, index) =>
      entry({
        id: `row-${index}`,
        createdAt: new Date(Date.UTC(2026, 9, 9, 8, index, 0)),
        customerId: index % 2 === 0 ? 'a' : 'b',
      }),
    );
    const view = presentJarWeekActivity(entries, reference);
    assert.equal(view.rows.length, JAR_WEEK_ACTIVITY_PREVIEW_LIMIT);
    assert.equal(view.totalExchanges, 9);
    assert.equal(view.participantCount, 2);
    assert.equal(view.rows[0]?.id, 'row-8');
  });

  it('reads the store from the transaction, not a signup store', () => {
    assert.equal(
      jarActivityStoreName({
        sourceType: 'jar_code_redeem',
        returnedMerchantName: '回收店',
        issuedMerchantName: '發放店',
      }),
      '回收店',
    );
    assert.equal(
      jarActivityStoreName({
        sourceType: 'jar_code_redeem',
        issuedMerchantName: '發放店',
      }),
      '發放店',
    );
    assert.equal(
      jarActivityStoreName({
        sourceType: 'refill_completed',
        refillMerchantName: '換罐店',
        issuedMerchantName: '不該用',
      }),
      '換罐店',
    );
    assert.equal(jarActivityStoreName({ sourceType: 'jar_code_redeem' }), null);
  });

  it('places a white activity block on the dashboard with a ledger link and no arrow icon', () => {
    const dashboard = readFileSync(new URL('../../../components/orders/oms-dashboard.tsx', import.meta.url), 'utf8');
    const block = readFileSync(
      new URL('../../../components/dashboard/dashboard-jar-week-activity.tsx', import.meta.url),
      'utf8',
    );
    assert.match(dashboard, /<DashboardJarWeekActivity\s*\/>/);
    assert.match(block, /本週換罐活動/);
    assert.match(block, /台灣時間/);
    assert.match(block, /查看全部/);
    assert.match(block, /\/jar-exchange\/manage\?tab=ledger/);
    assert.match(block, /這 7 天還沒有換罐交易/);
    assert.match(block, /bg-white/);
    assert.equal(block.includes('ArrowRight'), false);
    assert.equal(block.includes('lucide-react'), false);
  });
});
