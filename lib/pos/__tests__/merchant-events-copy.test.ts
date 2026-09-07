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

type World = {
  requests: RequestRow[];
  shipments: Array<{
    id: string;
    merchantId: string;
    shipmentNumber: string;
    status: string;
    updatedAt: Date;
    items: Array<{ productName: string; quantity: number }>;
  }>;
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

let world: World = { requests: [], shipments: [] };

const harness = globalThis as typeof globalThis & {
  __TEST_PRISMA__: {
    restockRequest: {
      findMany: (args: { where: { merchantId: string } }) => Promise<RequestRow[]>;
    };
    shipment: {
      findMany: (args: { where: { merchantId: string } }) => Promise<World['shipments']>;
    };
  };
};

harness.__TEST_PRISMA__ = {
  restockRequest: {
    findMany: async ({ where }) =>
      world.requests.filter((row) => row.merchantId === where.merchantId),
  },
  shipment: {
    findMany: async ({ where }) =>
      world.shipments.filter((row) => row.merchantId === where.merchantId),
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
});
