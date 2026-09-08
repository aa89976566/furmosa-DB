import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { before, describe, it } from 'node:test';

type RequestRow = {
  id: string;
  merchantId: string;
  status: string;
  updatedAt: Date;
  hqNote: string | null;
  items: Array<{
    requestedQuantity: number | null;
    approvedQuantity: number | null;
    product: { name: string };
  }>;
  shipment: {
    id: string;
    shipmentNumber: string;
    status: string;
    updatedAt: Date;
    items: Array<{ productName: string; quantity: number }>;
  } | null;
};

type DirectRow = {
  id: string;
  merchantId: string;
  type: string;
  restockRequestId: string | null;
  shipmentNumber: string;
  status: string;
  deliveredAt: Date | null;
  updatedAt: Date;
  items: Array<{ id: string; productName: string; quantity: number }>;
};

type StockTxn = {
  merchantId: string;
  shipmentItemId?: string | null;
  type?: string;
  note?: string | null;
};

type World = {
  requests: RequestRow[];
  shipments: DirectRow[];
  stockTxns: StockTxn[];
  failEvidence: boolean;
};

function requestRow(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: 'request-1',
    merchantId: 'merchant-1',
    status: 'rejected',
    updatedAt: new Date('2026-09-04'),
    hqNote: '庫存足夠',
    items: [
      {
        requestedQuantity: 5,
        approvedQuantity: 5,
        product: { name: '雞霸' },
      },
    ],
    shipment: null,
    ...overrides,
  };
}

let world: World = { requests: [], shipments: [], stockTxns: [], failEvidence: false };

function matchesDirectWhere(row: DirectRow, where: Record<string, unknown>) {
  if (where.merchantId && row.merchantId !== where.merchantId) return false;
  if (where.type && row.type !== where.type) return false;
  if (where.restockRequest === null && row.restockRequestId !== null) return false;
  const statusFilter = where.status as { in?: string[] } | undefined;
  if (statusFilter?.in && !statusFilter.in.includes(row.status)) return false;
  return true;
}

const harness = globalThis as typeof globalThis & {
  __TEST_PRISMA__: {
    restockRequest: {
      findMany: (args: { where: { merchantId: string } }) => Promise<RequestRow[]>;
    };
    shipment: {
      findMany: (args: { where: Record<string, unknown>; take?: number; orderBy?: unknown }) => Promise<unknown[]>;
    };
    merchantStockTxn: {
      findMany: (args: { where: Record<string, unknown> }) => Promise<unknown[]>;
    };
  };
};

harness.__TEST_PRISMA__ = {
  restockRequest: {
    findMany: async ({ where }) =>
      world.requests.filter((row) => row.merchantId === where.merchantId),
  },
  shipment: {
    findMany: async ({ where, take, orderBy }) => {
      const matched = world.shipments.filter((row) => matchesDirectWhere(row, where));
      const sorted = [...matched].sort((a, b) => {
        if (Array.isArray(orderBy)) {
          const aTime = a.deliveredAt?.getTime() ?? Number.POSITIVE_INFINITY;
          const bTime = b.deliveredAt?.getTime() ?? Number.POSITIVE_INFINITY;
          if (aTime !== bTime) return aTime - bTime;
          return a.shipmentNumber.localeCompare(b.shipmentNumber);
        }
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      return sorted.slice(0, take ?? sorted.length);
    },
  },
  merchantStockTxn: {
    findMany: async ({ where }) => {
      if (world.failEvidence) throw new Error('evidence failed');
      return world.stockTxns.filter((txn) => {
        if (txn.merchantId !== where.merchantId) return false;
        const itemFilter = where.shipmentItemId as { in?: string[] } | undefined;
        if (itemFilter?.in) return Boolean(txn.shipmentItemId && itemFilter.in.includes(txn.shipmentItemId));
        if (where.type && txn.type !== where.type) return false;
        const ors = where.OR as Array<{ note?: { contains?: string } }> | undefined;
        if (ors) {
          return ors.some((clause) =>
            Boolean(txn.note && clause.note?.contains && txn.note.includes(clause.note.contains)),
          );
        }
        return true;
      });
    },
  },
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

let loadMerchantEvents: (typeof import('@/lib/pos/load-merchant-events'))['loadMerchantEvents'];
let merchantEventHqNote: (typeof import('@/lib/pos/load-merchant-events'))['merchantEventHqNote'];
let restockQuantityAdjustmentDetail: (typeof import('@/lib/pos/load-merchant-events'))['restockQuantityAdjustmentDetail'];

describe('POS 補貨通知文案', () => {
  before(async () => {
    moduleApi._load = function patchedLoad(request, parent, isMain) {
      if (isPrismaRequest(String(request))) {
        return { prisma: harness.__TEST_PRISMA__ };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      ({
        loadMerchantEvents,
        merchantEventHqNote,
        restockQuantityAdjustmentDetail,
      } = await import('@/lib/pos/load-merchant-events'));
    } finally {
      moduleApi._load = originalLoad;
    }
  });

  it('調量時通知顯示申請量與核准量', () => {
    assert.equal(
      restockQuantityAdjustmentDetail([
        { requestedQuantity: 5, approvedQuantity: 3 },
      ]),
      '申請 5 件，核准 3 件',
    );
  });

  it('未調量時不得誤顯示調量文字', () => {
    assert.equal(
      restockQuantityAdjustmentDetail([
        { requestedQuantity: 5, approvedQuantity: 5 },
      ]),
      null,
    );
    assert.equal(
      restockQuantityAdjustmentDetail([{ requestedQuantity: 2, approvedQuantity: null }]),
      null,
    );
    assert.doesNotMatch('雞霸 × 5', /申請 \d+ 件，核准 \d+ 件/);
  });

  it('新拒絕案例店家端可見原因', async () => {
    world = {
      requests: [requestRow({ hqNote: '本週庫存仍足夠' })],
      shipments: [],
      stockTxns: [],
      failEvidence: false,
    };
    const events = await loadMerchantEvents('merchant-1');
    assert.equal(events[0]?.title, '補貨申請未核准');
    assert.equal(events[0]?.hqNote, '本週庫存仍足夠');

    const notifications = readFileSync(
      new URL('../../../app/pos/notifications/page.tsx', import.meta.url),
      'utf8',
    );
    assert.match(notifications, /event\.hqNote/);
    assert.match(notifications, /HQ 回覆：\{event\.hqNote\}/);

    const detail = readFileSync(
      new URL('../../../app/pos/restock/[id]/page.tsx', import.meta.url),
      'utf8',
    );
    assert.match(detail, /req\.hqNote/);
    assert.match(detail, /公司回覆/);
  });

  it('舊 hqNote 空值資料顯示 fallback、不空白也不壞畫面', async () => {
    assert.equal(merchantEventHqNote('rejected', null), '未提供原因');
    assert.equal(merchantEventHqNote('rejected', '   '), '未提供原因');
    assert.equal(merchantEventHqNote('approved', null), null);

    world = {
      requests: [requestRow({ hqNote: null })],
      shipments: [],
      stockTxns: [],
      failEvidence: false,
    };
    const events = await loadMerchantEvents('merchant-1');
    assert.equal(events[0]?.hqNote, '未提供原因');
    assert.notEqual(events[0]?.hqNote, '');
    assert.equal(typeof events[0]?.title, 'string');
  });

  it('核准且調量的轉出貨通知帶申請／核准量；未調量不帶', async () => {
    world = {
      requests: [
        requestRow({
          id: 'request-adjusted',
          status: 'converted_to_shipment',
          hqNote: null,
          items: [{ requestedQuantity: 4, approvedQuantity: 2, product: { name: '雞霸' } }],
          shipment: {
            id: 'shipment-adjusted',
            shipmentNumber: 'SHP-ADJ-0001',
            status: 'pending',
            updatedAt: new Date('2026-09-05'),
            items: [{ productName: '雞霸', quantity: 2 }],
          },
        }),
        requestRow({
          id: 'request-same',
          status: 'converted_to_shipment',
          hqNote: null,
          items: [{ requestedQuantity: 4, approvedQuantity: 4, product: { name: '雞霸' } }],
          shipment: {
            id: 'shipment-same',
            shipmentNumber: 'SHP-SAME-0001',
            status: 'pending',
            updatedAt: new Date('2026-09-04'),
            items: [{ productName: '雞霸', quantity: 4 }],
          },
        }),
      ],
      shipments: [],
      stockTxns: [],
      failEvidence: false,
    };
    const events = await loadMerchantEvents('merchant-1');
    const adjusted = events.find((event) => event.id === 'shipment-shipment-adjusted');
    const same = events.find((event) => event.id === 'shipment-shipment-same');
    assert.match(adjusted?.detail ?? '', /申請 4 件，核准 2 件/);
    assert.doesNotMatch(same?.detail ?? '', /申請 \d+ 件，核准 \d+ 件/);
    assert.doesNotMatch(same?.detail ?? '', /調量/);
  });

  it('跨店隔離回歸不受影響', async () => {
    world = {
      requests: [
        requestRow({ id: 'request-a', merchantId: 'merchant-1', hqNote: 'A 店原因' }),
        requestRow({ id: 'request-b', merchantId: 'merchant-2', hqNote: 'B 店原因' }),
      ],
      shipments: [],
      stockTxns: [],
      failEvidence: false,
    };
    const events = await loadMerchantEvents('merchant-1');
    assert.equal(events.length, 1);
    assert.equal(events[0]?.href, '/pos/restock/request-a');
    assert.equal(events[0]?.hqNote, 'A 店原因');
    assert.equal(
      events.some((event) => event.href === '/pos/restock/request-b'),
      false,
    );
  });

  function directShipment(overrides: Partial<DirectRow> = {}): DirectRow {
    return {
      id: 'direct-1',
      merchantId: 'merchant-1',
      type: 'merchant_restock',
      restockRequestId: null,
      shipmentNumber: 'SHP-DIR-0001',
      status: 'delivered',
      deliveredAt: new Date('2026-09-05'),
      updatedAt: new Date('2026-09-05'),
      items: [
        { id: 'item-1', productName: '雞霸', quantity: 2 },
        { id: 'item-2', productName: '水晶魚', quantity: 3 },
      ],
      ...overrides,
    };
  }

  it('posted delivered direct shows 已入帳 and keeps href', async () => {
    world = {
      requests: [],
      shipments: [directShipment()],
      stockTxns: [
        { merchantId: 'merchant-1', shipmentItemId: 'item-1' },
        { merchantId: 'merchant-1', shipmentItemId: 'item-2' },
      ],
      failEvidence: false,
    };
    const events = await loadMerchantEvents('merchant-1');
    assert.equal(events[0]?.title, '商品已送達');
    assert.equal(events[0]?.statusLabel, '已送達（庫存已入帳）');
    assert.equal(events[0]?.actionRequired, false);
    assert.equal(events[0]?.href, '/pos/shipments/direct-1');
  });

  it('partial item txn and ambiguous note stay 待驗收', async () => {
    world = {
      requests: [],
      shipments: [
        directShipment({ id: 'partial-1', shipmentNumber: 'SHP-PART-0001' }),
        directShipment({
          id: 'amb-1',
          shipmentNumber: 'SHP-AMB-0001',
          items: [{ id: 'item-amb', productName: '雞霸', quantity: 1 }],
        }),
      ],
      stockTxns: [
        { merchantId: 'merchant-1', shipmentItemId: 'item-1' },
        {
          merchantId: 'merchant-1',
          type: 'restock',
          note: '[來源] 出貨紀錄（備註：SHP-AMB-0001）',
        },
      ],
      failEvidence: false,
    };
    const events = await loadMerchantEvents('merchant-1');
    const partial = events.find((event) => event.id === 'shipment-partial-1');
    const ambiguous = events.find((event) => event.id === 'shipment-amb-1');
    assert.equal(partial?.title, '商品已送達，請確認收貨');
    assert.equal(partial?.statusLabel, '待驗收');
    assert.equal(partial?.actionRequired, true);
    assert.equal(ambiguous?.title, '商品已送達，請確認收貨');
    assert.equal(ambiguous?.statusLabel, '待驗收');
    assert.equal(ambiguous?.actionRequired, true);
  });

  it('unposted delivered direct stays 待驗收', async () => {
    world = {
      requests: [],
      shipments: [directShipment()],
      stockTxns: [],
      failEvidence: false,
    };
    const events = await loadMerchantEvents('merchant-1');
    assert.equal(events[0]?.title, '商品已送達，請確認收貨');
    assert.equal(events[0]?.statusLabel, '待驗收');
    assert.equal(events[0]?.actionRequired, true);
    assert.equal(events[0]?.href, '/pos/shipments/direct-1');
  });

  it('evidence throw keeps 待驗收 and does not reject', async () => {
    world = {
      requests: [],
      shipments: [directShipment()],
      stockTxns: [
        { merchantId: 'merchant-1', shipmentItemId: 'item-1' },
        { merchantId: 'merchant-1', shipmentItemId: 'item-2' },
      ],
      failEvidence: true,
    };
    const events = await loadMerchantEvents('merchant-1');
    assert.equal(events[0]?.title, '商品已送達，請確認收貨');
    assert.equal(events[0]?.statusLabel, '待驗收');
    assert.equal(events[0]?.actionRequired, true);
    assert.equal(events[0]?.href, '/pos/shipments/direct-1');
  });

  it('other direct statuses and request copy stay unchanged', async () => {
    world = {
      requests: [requestRow({ hqNote: '本週庫存仍足夠' })],
      shipments: [directShipment({ id: 'shipped-1', status: 'shipped', shipmentNumber: 'SHP-SHIP-0001' })],
      stockTxns: [],
      failEvidence: false,
    };
    const events = await loadMerchantEvents('merchant-1');
    const request = events.find((event) => event.id === 'request-request-1');
    const shipped = events.find((event) => event.id === 'shipment-shipped-1');
    assert.equal(request?.title, '補貨申請未核准');
    assert.equal(request?.hqNote, '本週庫存仍足夠');
    assert.equal(shipped?.title, '商品已出貨');
    assert.equal(shipped?.statusLabel, '運送中');
    assert.equal(shipped?.actionRequired, false);
  });

  it('direct shipments from another store do not appear', async () => {
    world = {
      requests: [],
      shipments: [directShipment({ merchantId: 'merchant-2' })],
      stockTxns: [],
      failEvidence: false,
    };
    const events = await loadMerchantEvents('merchant-1');
    assert.equal(events.length, 0);
  });
});
