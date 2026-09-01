import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { restockStatusLabelForMerchant } from '@/lib/restock-request/constants';
import { buildHomeTaskCards } from '@/lib/pos/home-tasks';
import {
  listMerchantRestockProgress,
  merchantRestockProgressLabel,
  merchantRestockQueryFeedStatus,
  projectHomeRestockNotice,
  restockHomeFromSettled,
  shipmentStatusForMerchant,
  type RestockProgressListArgs,
  type RestockProgressListRow,
} from '@/lib/pos/restock-progress';

const merchantId = 'mer_demo';
const otherMerchantId = 'mer_other';

describe('unconverted merchant restock copy stays the same', () => {
  it('keeps existing request-only labels', () => {
    const merchantByHq: Record<string, string> = {
      submitted: '公司確認中',
      under_review: '公司確認中',
      approved: '已確認',
      rejected: '需要調整',
      cancelled: '已取消',
    };
    for (const [status, label] of Object.entries(merchantByHq)) {
      assert.equal(restockStatusLabelForMerchant(status), label);
      assert.equal(merchantRestockProgressLabel(status, null), label);
      assert.equal(merchantRestockProgressLabel(status, 'shipped'), label);
    }
    assert.equal(merchantRestockQueryFeedStatus('submitted', null), '已送出');
    assert.equal(merchantRestockQueryFeedStatus('under_review', null), '已送出');
    assert.equal(merchantRestockQueryFeedStatus('approved', null), '已送出');
  });
});

describe('converted restock progress follows linked shipment', () => {
  it('maps pending to 備貨中, shipped to 配送中, delivered to 已到貨', () => {
    assert.equal(merchantRestockProgressLabel('converted_to_shipment', 'pending'), '備貨中');
    assert.equal(merchantRestockProgressLabel('converted_to_shipment', 'packed'), '備貨中');
    assert.equal(merchantRestockProgressLabel('converted_to_shipment', 'shipped'), '配送中');
    assert.equal(merchantRestockProgressLabel('converted_to_shipment', 'delivered'), '已到貨');
  });

  it('does not guess 備貨中 or 已到貨 when shipment is missing or unknown', () => {
    assert.equal(
      merchantRestockProgressLabel('converted_to_shipment', null),
      '進度待確認',
    );
    assert.equal(
      merchantRestockProgressLabel('converted_to_shipment', undefined),
      '進度待確認',
    );
    assert.equal(
      merchantRestockProgressLabel('converted_to_shipment', ''),
      '進度待確認',
    );
    assert.equal(
      merchantRestockProgressLabel('converted_to_shipment', 'cancelled'),
      '進度待確認',
    );
    assert.equal(
      merchantRestockProgressLabel('converted_to_shipment', 'mystery'),
      '進度待確認',
    );
  });

  it('ignores another store shipment even if it is linked', () => {
    assert.equal(
      shipmentStatusForMerchant(
        { status: 'delivered', merchantId: otherMerchantId },
        merchantId,
      ),
      null,
    );
    assert.equal(
      merchantRestockProgressLabel(
        'converted_to_shipment',
        shipmentStatusForMerchant(
          { status: 'delivered', merchantId: otherMerchantId },
          merchantId,
        ),
      ),
      '進度待確認',
    );
  });
});

describe('homepage waiting-to-ship count', () => {
  const rows = [
    { id: 'r-submitted', status: 'submitted', shipment: null },
    {
      id: 'r-pending',
      status: 'converted_to_shipment',
      shipment: { status: 'pending', merchantId },
    },
    {
      id: 'r-shipped',
      status: 'converted_to_shipment',
      shipment: { status: 'shipped', merchantId },
    },
    {
      id: 'r-delivered',
      status: 'converted_to_shipment',
      shipment: { status: 'delivered', merchantId },
    },
    {
      id: 'r-foreign',
      status: 'converted_to_shipment',
      shipment: { status: 'pending', merchantId: otherMerchantId },
    },
  ];

  it('excludes shipped and delivered from 等待出貨', () => {
    const notice = projectHomeRestockNotice(rows, merchantId);
    assert.equal(notice.waitingToShipCount, 2);
    assert.deepEqual(
      [notice.firstWaitingRestockId, notice.firstInTransitRestockId],
      ['r-submitted', 'r-shipped'],
    );
    assert.equal(notice.inTransitCount, 1);
  });

  it('uses 等待出貨 copy only for waiting items and keeps an in-transit entry', () => {
    const waiting = buildHomeTaskCards({
      pendingRefillCount: 0,
      lowStock: null,
      waitingToShipCount: 2,
      inTransitRestockCount: 1,
      firstWaitingRestockId: 'r-pending',
      firstInTransitRestockId: 'r-shipped',
    });
    assert.equal(waiting[0]?.subtitle, '2 筆等待出貨');
    assert.equal(waiting[0]?.href, '/pos/restock/r-pending');

    const inTransitOnly = buildHomeTaskCards({
      pendingRefillCount: 0,
      lowStock: null,
      waitingToShipCount: 0,
      inTransitRestockCount: 1,
      firstWaitingRestockId: null,
      firstInTransitRestockId: 'r-shipped',
    });
    assert.equal(inTransitOnly[0]?.subtitle, '配送中');
    assert.doesNotMatch(inTransitOnly[0]?.subtitle ?? '', /等待出貨/);
    assert.equal(inTransitOnly[0]?.href, '/pos/restock/r-shipped');
  });

  it('does not treat a failed restock query as a normal empty list', () => {
    const failed = restockHomeFromSettled(
      { status: 'rejected', reason: new Error('db down') },
      merchantId,
    );
    const emptyOk = restockHomeFromSettled({ status: 'fulfilled', value: [] }, merchantId);
    assert.equal(failed.kind, 'error');
    assert.equal(emptyOk.kind, 'ok');
    assert.equal(emptyOk.kind === 'ok' ? emptyOk.notice.waitingToShipCount : -1, 0);
  });
});

describe('list, detail, and homepage share one progress rule', () => {
  it('uses the same label for list/detail/home/query-feed projections', () => {
    const label = merchantRestockProgressLabel('converted_to_shipment', 'shipped');
    assert.equal(label, '配送中');
    assert.equal(merchantRestockQueryFeedStatus('converted_to_shipment', 'shipped'), label);
    const notice = projectHomeRestockNotice(
      [
        {
          id: 'r1',
          status: 'converted_to_shipment',
          shipment: { status: 'shipped', merchantId },
        },
      ],
      merchantId,
    );
    assert.equal(notice.waitingToShipCount, 0);
    assert.equal(notice.inTransitCount, 1);
  });

  it('progress list query is merchant-scoped and does not swallow errors as []', async () => {
    const seen: RestockProgressListArgs[] = [];
    const db = {
      restockRequest: {
        findMany: async (args: RestockProgressListArgs): Promise<RestockProgressListRow[]> => {
          seen.push(args);
          return [
            {
              id: 'mine',
              requestType: 'SELF_SELECT',
              status: 'converted_to_shipment',
              createdAt: new Date('2026-08-30T00:00:00.000Z'),
              expectedArrivalDate: null,
              shipment: { status: 'shipped', merchantId },
            },
            {
              id: 'foreign-link',
              requestType: 'SELF_SELECT',
              status: 'converted_to_shipment',
              createdAt: new Date('2026-08-29T00:00:00.000Z'),
              expectedArrivalDate: null,
              shipment: { status: 'delivered', merchantId: otherMerchantId },
            },
          ];
        },
      },
    };
    const rows = await listMerchantRestockProgress(db, merchantId);
    assert.equal(seen[0]?.where.merchantId, merchantId);
    assert.equal(rows[0]?.progressLabel, '配送中');
    assert.equal(rows[1]?.progressLabel, '進度待確認');

    await assert.rejects(
      () =>
        listMerchantRestockProgress(
          {
            restockRequest: {
              findMany: async (_args: RestockProgressListArgs): Promise<RestockProgressListRow[]> => {
                throw new Error('query failed');
              },
            },
          },
          merchantId,
        ),
      /query failed/,
    );
  });
});

describe('POS restock surfaces wire the shared progress helper', () => {
  it('list, detail, homepage, and query feed all call the shared mapping', () => {
    const listSrc = readFileSync(
      new URL('../../../app/pos/restock/progress/page.tsx', import.meta.url),
      'utf8',
    );
    const detailSrc = readFileSync(
      new URL('../../../app/pos/restock/[id]/page.tsx', import.meta.url),
      'utf8',
    );
    const homeSrc = readFileSync(new URL('../load-today-dashboard.ts', import.meta.url), 'utf8');
    const feedSrc = readFileSync(new URL('../load-query-feed.ts', import.meta.url), 'utf8');
    const serviceSrc = readFileSync(
      new URL('../../restock-request/service.ts', import.meta.url),
      'utf8',
    );

    assert.match(listSrc, /listMerchantRestockProgress/);
    assert.doesNotMatch(listSrc, /restockStatusLabelForMerchant/);
    assert.match(detailSrc, /merchantRestockProgressLabel/);
    assert.match(detailSrc, /shipmentStatusForMerchant/);
    assert.match(homeSrc, /restockHomeFromSettled/);
    assert.match(homeSrc, /merchantId/);
    assert.match(feedSrc, /merchantRestockQueryFeedStatus/);
    assert.match(serviceSrc, /where: \{ id: requestId, merchantId \}/);
    assert.match(serviceSrc, /merchantId: true/);
  });
});
