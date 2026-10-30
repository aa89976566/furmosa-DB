import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import Module, { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { before, describe, it } from 'node:test';
import { filterQueryFeed, formatQueryDate, formatQueryDateHeading, formatQueryTime, formatQueryWhen, groupSaleLines, type QueryFeedItem } from '@/lib/pos/query-feed';

const SAME_DAY_NOW = new Date('2026-09-08T04:00:00.000Z'); // Taipei 12:00

if (process.env.FORMAT_QUERY_WHEN_TZ_PROBE === '1') {
  process.stdout.write(
    formatQueryWhen(process.env.FORMAT_ISO ?? '', new Date(process.env.FORMAT_NOW ?? '')),
  );
  process.exit(0);
}

describe('formatQueryWhen', () => {
  it('formats same Taipei day with 上午/下午, unpadded hour, padded minute, no space', () => {
    assert.equal(formatQueryWhen('2026-09-07T16:05:00.000Z', SAME_DAY_NOW), '上午12:05');
    assert.equal(formatQueryWhen('2026-09-08T01:05:00.000Z', SAME_DAY_NOW), '上午9:05');
    assert.equal(formatQueryWhen('2026-09-08T03:59:00.000Z', SAME_DAY_NOW), '上午11:59');
    assert.equal(formatQueryWhen('2026-09-08T04:00:00.000Z', SAME_DAY_NOW), '下午12:00');
    assert.equal(formatQueryWhen('2026-09-08T13:05:00.000Z', SAME_DAY_NOW), '下午9:05');
    assert.equal(formatQueryWhen('2026-09-08T15:07:00.000Z', SAME_DAY_NOW), '下午11:07');
  });

  it('splits Taipei midnight into different calendar days', () => {
    const beforeMidnight = new Date('2026-09-07T15:00:00.000Z'); // Taipei 23:00 on 09/07
    const afterMidnight = new Date('2026-09-07T16:00:00.000Z'); // Taipei 00:00 on 09/08
    assert.equal(formatQueryWhen('2026-09-07T15:59:59.000Z', beforeMidnight), '下午11:59');
    assert.equal(formatQueryWhen('2026-09-07T15:59:59.000Z', afterMidnight), '09/07');
    assert.equal(formatQueryWhen('2026-09-07T16:00:00.000Z', afterMidnight), '上午12:00');
  });

  it('uses zero-padded MM/DD for a different Taipei day', () => {
    assert.equal(formatQueryWhen('2026-09-06T04:00:00.000Z', SAME_DAY_NOW), '09/06');
    assert.equal(formatQueryWhen('2026-01-02T16:00:00.000Z', SAME_DAY_NOW), '01/03');
  });

  it('returns em dash for invalid iso or now and does not throw', () => {
    assert.equal(formatQueryWhen('not-a-date', SAME_DAY_NOW), '—');
    assert.equal(formatQueryWhen('', SAME_DAY_NOW), '—');
    assert.equal(formatQueryWhen('2026-09-08T04:00:00.000Z', new Date('invalid')), '—');
    assert.doesNotThrow(() => formatQueryWhen('not-a-date', new Date(Number.NaN)));
  });

  it('returns the same string under UTC, New York, and Taipei timezones', () => {
    const iso = '2026-09-07T16:05:00.000Z';
    const nowIso = SAME_DAY_NOW.toISOString();
    const labels = ['UTC', 'America/New_York', 'Asia/Taipei'].map((tz) => {
      const result = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url)], {
        env: {
          ...process.env,
          TZ: tz,
          FORMAT_QUERY_WHEN_TZ_PROBE: '1',
          FORMAT_ISO: iso,
          FORMAT_NOW: nowIso,
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    });
    assert.deepEqual(labels, ['上午12:05', '上午12:05', '上午12:05']);
  });
});

describe('record date grouping', () => {
  it('formats stable Taipei date and 24-hour time labels', () => {
    assert.equal(formatQueryDate('2026-09-07T16:05:00.000Z'), '09/08（二）');
    assert.equal(formatQueryDateHeading('2026-09-07T16:05:00.000Z'), '9月8日・星期二');
    assert.equal(formatQueryTime('2026-09-07T16:05:00.000Z'), '00:05');
  });
});

describe('groupSaleLines', () => {
  it('groups same-second sales into one 已完成 ticket', () => {
    const at = new Date('2026-08-26T10:42:01.200Z');
    const items = groupSaleLines(
      [
        { id: '1', createdAt: at, quantity: -2, unitPrice: 129, productName: '水晶魚' },
        { id: '2', createdAt: new Date(at.getTime() + 20), quantity: -1, unitPrice: 99, productName: '雞霸 原味' },
      ],
      new Date('2026-08-26T12:00:00.000Z'),
    );
    assert.equal(items.length, 1);
    assert.equal(items[0]?.kind, 'sale');
    assert.equal(items[0]?.status, '已完成');
    assert.equal(items[0]?.title, '水晶魚、雞霸 原味');
    assert.equal(items[0]?.quantityLabel, '共 3 件');
    assert.equal(typeof items[0]?.whenLabel, 'string');
    assert.notEqual(items[0]?.whenLabel, '');
  });
});

describe('filterQueryFeed', () => {
  const items: QueryFeedItem[] = [
    {
      id: 'r1',
      kind: 'refill',
      at: '2026-08-26T09:00:00.000Z',
      whenLabel: '下午5:00',
      title: '換罐',
      subtitle: '#A3812 → #B9981',
      status: '已完成',
      href: '/pos/refill/1',
      searchText: 'a3812 b9981 王小姐',
    },
    {
      id: 's1',
      kind: 'sale',
      at: '2026-08-26T10:00:00.000Z',
      whenLabel: '下午6:00',
      title: '水晶魚 × 2',
      subtitle: 'NT$258',
      status: '已完成',
      href: '/pos/records',
      searchText: '水晶魚 258',
    },
  ];

  it('filters by kind and serial search', () => {
    assert.equal(filterQueryFeed(items, 'sale', '').length, 1);
    assert.equal(filterQueryFeed(items, 'all', 'A3812').length, 1);
    assert.equal(filterQueryFeed(items, 'all', '水晶魚').length, 1);
  });
});

describe('query-board client render', () => {
  it('renders whenLabel and has no client time formatting', () => {
    const source = readFileSync(new URL('../../../components/pos/query-board.tsx', import.meta.url), 'utf8');
    assert.match(source, /item\.whenLabel/);
    assert.doesNotMatch(source, /formatQueryWhen/);
    assert.doesNotMatch(source, /toLocale/);
    assert.doesNotMatch(source, /new Date\(/);
  });
});

type FeedWorld = {
  sales: Array<{
    id: string;
    createdAt: Date;
    quantity: number;
    unitPrice: number;
    product: { name: string };
  }>;
  refills: Array<{
    id: string;
    createdAt: Date;
    status: string;
    oldContainerSerial: string | null;
    newContainerSerial: string | null;
    customer: { name: string };
  }>;
  restocks: Array<{
    id: string;
    createdAt: Date;
    status: string;
    shipment?: { status: string; shippedAt?: Date | null; receivedAt?: Date | null } | null;
    items: Array<{ requestedQuantity: number; weightGrams?: number | null; product: { name: string; unit?: string | null } }>;
  }>;
  directShipments: unknown[];
  stockTxns: Array<{
    id: string;
    createdAt: Date;
    type: string;
    quantity: number;
    balanceAfter: number;
    product: { name: string };
  }>;
};

let feedWorld: FeedWorld = { sales: [], refills: [], restocks: [], directShipments: [], stockTxns: [] };

const feedHarness = globalThis as typeof globalThis & {
  __TEST_PRISMA__: {
    merchantStockTxn: { findMany: (args: { where: { type?: string | { notIn?: string[] } } }) => Promise<unknown[]> };
    refillOrder: { findMany: () => Promise<unknown[]> };
    restockRequest: { findMany: () => Promise<unknown[]> };
    shipment: { findMany: () => Promise<unknown[]> };
  };
};

feedHarness.__TEST_PRISMA__ = {
  merchantStockTxn: {
    findMany: async ({ where }) => where.type === 'sale'
      ? feedWorld.sales
      : feedWorld.stockTxns.filter((row) => !['sale', 'restock'].includes(row.type)),
  },
  refillOrder: { findMany: async () => feedWorld.refills },
  restockRequest: { findMany: async () => feedWorld.restocks },
  shipment: { findMany: async () => feedWorld.directShipments },
};

const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/prisma') return mockPrisma();
  const resolved = await nextResolve(specifier, context);
  const url = String(resolved.url || '');
  if (url.includes('/lib/prisma.') || url.endsWith('/lib/prisma')) return mockPrisma();
  return resolved;
}
function mockPrisma() {
  return {
    shortCircuit: true,
    url: 'data:text/javascript,export const prisma = globalThis.__TEST_PRISMA__;',
  };
}
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, pathToFileURL(import.meta.url));

type NodeModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;
const moduleApi = Module as unknown as { _load: NodeModuleLoad };
const originalLoad = moduleApi._load;

function isPrismaRequest(request: string) {
  return (
    request === '@/lib/prisma' ||
    request.endsWith('/lib/prisma') ||
    request.endsWith('/lib/prisma.ts') ||
    request.includes('/lib/prisma.')
  );
}

let loadQueryFeed: (typeof import('@/lib/pos/load-query-feed'))['loadQueryFeed'];
let restockFeedStatus: (typeof import('@/lib/pos/load-query-feed'))['restockFeedStatus'];
let restockProgressStage: (typeof import('@/lib/pos/load-query-feed'))['restockProgressStage'];
let nextReceiptReminderDate: (typeof import('@/lib/pos/load-query-feed'))['nextReceiptReminderDate'];
let cleanPosProductName: (typeof import('@/lib/pos/load-query-feed'))['cleanPosProductName'];
let summarizeRestockLines: (typeof import('@/lib/pos/load-query-feed'))['summarizeRestockLines'];

function withFrozenNow<T>(now: Date, fn: () => T): T {
  const RealDate = Date;
  function DateMock(...args: unknown[]) {
    if (args.length === 0) return new RealDate(now.getTime());
    return new RealDate(...(args as ConstructorParameters<typeof Date>));
  }
  DateMock.now = () => now.getTime();
  DateMock.parse = RealDate.parse;
  DateMock.UTC = RealDate.UTC;
  const previous = globalThis.Date;
  globalThis.Date = DateMock as unknown as DateConstructor;
  try {
    return fn();
  } finally {
    globalThis.Date = previous;
  }
}

describe('loadQueryFeed whenLabel', () => {
  before(async () => {
    moduleApi._load = function patchedLoad(request, parent, isMain) {
      if (isPrismaRequest(String(request))) {
        return { prisma: feedHarness.__TEST_PRISMA__ };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      ({ loadQueryFeed, restockFeedStatus, restockProgressStage, nextReceiptReminderDate, cleanPosProductName, summarizeRestockLines } = await import('@/lib/pos/load-query-feed'));
    } finally {
      moduleApi._load = originalLoad;
    }
  });

  it('uses the shipment state after a restock request becomes a shipment', () => {
    assert.equal(restockFeedStatus('converted_to_shipment', 'packed'), '尚未出貨');
    assert.equal(restockFeedStatus('converted_to_shipment', 'shipped'), '運送中');
    assert.equal(restockFeedStatus('converted_to_shipment', 'received'), '店家已收貨');
    assert.equal(restockProgressStage('converted_to_shipment', 'packed'), 'not_shipped');
    assert.equal(restockProgressStage('converted_to_shipment', 'delivered'), 'in_transit');
    assert.equal(restockProgressStage('converted_to_shipment', 'received'), 'received');
  });

  it('uses day 3 and day 5 as receipt reminder checkpoints', () => {
    const shippedAt = new Date('2026-10-30T02:00:00.000Z');
    assert.equal(nextReceiptReminderDate(shippedAt, new Date('2026-10-31T02:00:00.000Z'))?.toISOString(), '2026-11-02T02:00:00.000Z');
    assert.equal(nextReceiptReminderDate(shippedAt, new Date('2026-11-02T03:00:00.000Z'))?.toISOString(), '2026-11-04T02:00:00.000Z');
    assert.equal(nextReceiptReminderDate(shippedAt, new Date('2026-11-04T03:00:00.000Z')), null);
  });

  it('uses canonical readable names and keeps every received line inside one shipment record', () => {
    assert.equal(cleanPosProductName('� ◇ 狗屎運 ◇ '), '狗屎運');
    assert.deepEqual(
      summarizeRestockLines([
        { productName: '牛肉地瓜', weightGrams: 30, quantity: 5, unit: '包' },
        { productName: '鴨肺', quantity: 2, unit: 'g' },
      ]),
      {
        summaryLabel: '牛肉地瓜 30g 等 2 項',
        items: [
          { label: '牛肉地瓜 30g', quantityLabel: '5 包' },
          { label: '鴨肺', quantityLabel: '2 g' },
        ],
      },
    );
  });

  it('labels all four item kinds from the same now', async () => {
    const createdAt = new Date('2026-09-08T01:05:00.000Z');
    feedWorld = {
      sales: [
        { id: 'sale-1', createdAt, quantity: -1, unitPrice: 99, product: { name: '雞霸' } },
      ],
      refills: [
        {
          id: 'refill-1',
          createdAt,
          status: 'completed',
          oldContainerSerial: 'A1',
          newContainerSerial: 'B1',
          customer: { name: '王小姐' },
        },
      ],
      restocks: [
        {
          id: 'restock-1',
          createdAt,
          status: 'submitted',
          items: [{ requestedQuantity: 2, product: { name: '水晶魚' } }],
        },
      ],
      directShipments: [],
      stockTxns: [
        {
          id: 'stock-1',
          createdAt,
          type: 'adjust',
          quantity: 1,
          balanceAfter: 4,
          product: { name: '雞霸' },
        },
      ],
    };

    const items = await withFrozenNow(SAME_DAY_NOW, () => loadQueryFeed('merchant-1'));
    const kinds = new Set(items.map((item) => item.kind));
    assert.deepEqual([...kinds].sort(), ['refill', 'restock', 'sale', 'stock']);
    for (const item of items) {
      assert.equal(item.whenLabel, formatQueryWhen(item.at, SAME_DAY_NOW));
      assert.equal(item.whenLabel, '上午9:05');
    }
  });

  it('shows a direct HQ shipment once and does not repeat its per-item stock postings', async () => {
    const createdAt = new Date('2026-09-08T01:05:00.000Z');
    feedWorld = {
      sales: [],
      refills: [],
      restocks: [],
      directShipments: [{
        id: 'shipment-1',
        status: 'received',
        createdAt,
        updatedAt: createdAt,
        shippedAt: createdAt,
        receivedAt: createdAt,
        items: [
          { productName: '� ◇ 狗屎運 ◇', quantity: 5, unit: '包', weightGrams: 30, product: { name: '牛肉地瓜' } },
          { productName: '鴨肺', quantity: 2, unit: 'g', weightGrams: null, product: { name: '鴨肺' } },
        ],
      }],
      stockTxns: [
        { id: 'posted-1', createdAt, type: 'restock', quantity: 5, balanceAfter: 5, product: { name: '牛肉地瓜' } },
        { id: 'posted-2', createdAt, type: 'restock', quantity: 2, balanceAfter: 2, product: { name: '鴨肺' } },
      ],
    };

    const items = await withFrozenNow(SAME_DAY_NOW, () => loadQueryFeed('merchant-1'));
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, 'shipment-shipment-1');
    assert.equal(items[0]?.title, '匠寵補貨');
    assert.equal(items[0]?.status, '店家已收貨');
    assert.deepEqual(items[0]?.restockProgress?.items, [
      { label: '牛肉地瓜 30g', quantityLabel: '5 包' },
      { label: '鴨肺', quantityLabel: '2 g' },
    ]);
  });
});
