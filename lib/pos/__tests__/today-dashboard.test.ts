import assert from 'node:assert/strict';
import Module, { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { before, describe, it } from 'node:test';
import { buildHomeTaskCards, isInventoryReliable } from '@/lib/pos/home-tasks';

function emptyInput() {
  return {
    pendingRefillCount: 0,
    awaitingRestockReceiptCount: 0,
    firstAwaitingRestockReceiptHref: null,
    firstAwaitingRestockShipmentNumber: null,
    lowStock: null as { productName: string; quantity: number }[] | null,
    openRestockCount: 0,
    firstOpenRestockId: null as string | null,
  };
}

describe('buildHomeTaskCards', () => {
  it('omits empty cards', () => {
    const cards = buildHomeTaskCards(emptyInput());
    assert.equal(cards.length, 0);
  });

  it('orders 待換罐 → 庫存不足 → 補貨中', () => {
    const cards = buildHomeTaskCards({
      ...emptyInput(),
      pendingRefillCount: 3,
      lowStock: [
        { productName: '柳葉魚凍乾', quantity: 0 },
        { productName: '水晶魚', quantity: 2 },
      ],
      openRestockCount: 2,
      firstOpenRestockId: 'r1',
    });
    assert.deepEqual(
      cards.map((c) => c.kind),
      ['pending_refill', 'low_stock', 'restock_progress'],
    );
    assert.equal(cards[0]?.title, '待換罐');
    assert.equal(cards[0]?.subtitle, '3 筆客人尚未領取');
    assert.equal(cards[0]?.badgeUnit, '筆');
    assert.match(cards[1]?.subtitle ?? '', /柳葉魚凍乾 已售完/);
    assert.equal(cards[1]?.href, '/pos/stock?filter=low');
    assert.equal(cards[1]?.badgeUnit, '項');
    assert.equal(cards[2]?.title, '補貨中');
    assert.equal(cards[2]?.subtitle, '2 筆等待出貨');
    assert.equal(cards[2]?.href, '/pos/restock/r1');
  });

  it('hides low stock when inventory is unreliable', () => {
    const cards = buildHomeTaskCards({
      ...emptyInput(),
      openRestockCount: 1,
      firstOpenRestockId: 'r1',
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.kind, 'restock_progress');
  });

  it('shows delivered restocks before other operational tasks', () => {
    const cards = buildHomeTaskCards({
      ...emptyInput(),
      pendingRefillCount: 1,
      awaitingRestockReceiptCount: 2,
      firstAwaitingRestockReceiptHref: '/pos/restock/r2',
      firstAwaitingRestockShipmentNumber: null,
    });
    assert.equal(cards[0]?.kind, 'awaiting_restock_receipt');
    assert.equal(cards[0]?.href, '/pos/restock/r2');
    assert.match(cards[0]?.title ?? '', /請確認收到貨/);
    assert.equal(cards[0]?.subtitle, '確認品項與數量正確後，商品才會加入可售庫存');
  });

  it('adds the earliest shipment number only when count > 1 and number is present', () => {
    const withNumber = buildHomeTaskCards({
      ...emptyInput(),
      awaitingRestockReceiptCount: 2,
      firstAwaitingRestockReceiptHref: '/pos/shipments/s1',
      firstAwaitingRestockShipmentNumber: 'SHP-OLD-0001',
    });
    assert.match(withNumber[0]?.subtitle ?? '', /確認品項與數量正確後，商品才會加入可售庫存/);
    assert.match(withNumber[0]?.subtitle ?? '', /先處理最早送達的 SHP-OLD-0001/);
    assert.doesNotMatch(withNumber[0]?.subtitle ?? '', /s1/);

    const nullNumber = buildHomeTaskCards({
      ...emptyInput(),
      awaitingRestockReceiptCount: 2,
      firstAwaitingRestockReceiptHref: '/pos/restock/r2',
      firstAwaitingRestockShipmentNumber: null,
    });
    assert.equal(nullNumber[0]?.subtitle, '確認品項與數量正確後，商品才會加入可售庫存');
    assert.equal(nullNumber[0]?.href, '/pos/restock/r2');
  });

  it('falls back to /pos/restock/progress when href is missing', () => {
    const cards = buildHomeTaskCards({
      ...emptyInput(),
      awaitingRestockReceiptCount: 1,
      firstAwaitingRestockReceiptHref: null,
      firstAwaitingRestockShipmentNumber: null,
    });
    assert.equal(cards[0]?.href, '/pos/restock/progress');
  });

  it('shows a + badge only when capped and count > 0', () => {
    const capped = buildHomeTaskCards({
      ...emptyInput(),
      awaitingRestockReceiptCount: 3,
      firstAwaitingRestockReceiptHref: '/pos/shipments/s1',
      firstAwaitingRestockShipmentNumber: 'SHP-1',
      awaitingRestockReceiptCountCapped: true,
    });
    assert.equal(capped[0]?.badge, '3+');
    assert.equal(capped[0]?.badgeUnit, '筆');

    const hidden = buildHomeTaskCards({
      ...emptyInput(),
      awaitingRestockReceiptCount: 0,
      awaitingRestockReceiptCountCapped: true,
    });
    assert.equal(hidden.length, 0);
  });
});

describe('isInventoryReliable', () => {
  it('requires at least one stock row', () => {
    assert.equal(isInventoryReliable(0), false);
    assert.equal(isInventoryReliable(3), true);
  });
});

type OpenRequest = {
  id: string;
  merchantId: string;
  status: string;
  createdAt: Date;
  shipment: {
    id?: string;
    status: string;
    shipmentNumber?: string;
    deliveredAt?: Date | null;
    updatedAt?: Date;
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

type HomeWorld = {
  requests: OpenRequest[];
  directs: DirectRow[];
  stockTxns: StockTxn[];
  failDeliveredRequests: boolean;
  failDirect: boolean;
  failEvidence: boolean;
};

let homeWorld: HomeWorld = {
  requests: [],
  directs: [],
  stockTxns: [],
  failDeliveredRequests: false,
  failDirect: false,
  failEvidence: false,
};

function matchesShipmentWhere(row: DirectRow, where: Record<string, unknown>) {
  if (where.merchantId && row.merchantId !== where.merchantId) return false;
  if (where.type && row.type !== where.type) return false;
  if (where.restockRequest === null && row.restockRequestId !== null) return false;
  const statusFilter = where.status as { in?: string[] } | string | undefined;
  if (statusFilter && typeof statusFilter === 'object' && statusFilter.in) {
    if (!statusFilter.in.includes(row.status)) return false;
  } else if (typeof statusFilter === 'string' && row.status !== statusFilter) {
    return false;
  }
  return true;
}

function sortDirects(rows: DirectRow[], order: unknown) {
  const copy = [...rows];
  if (Array.isArray(order)) {
    copy.sort((a, b) => {
      const aTime = a.deliveredAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTime = b.deliveredAt?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;
      return a.shipmentNumber.localeCompare(b.shipmentNumber);
    });
  } else {
    copy.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  return copy;
}

const homeHarness = globalThis as typeof globalThis & {
  __TEST_PRISMA__: {
    restockRequest: { findMany: (args: Record<string, unknown>) => Promise<unknown[]> };
    merchantStock: { findMany: () => Promise<unknown[]> };
    refillOrder: { count: () => Promise<number> };
    shipment: { findMany: (args: Record<string, unknown>) => Promise<unknown[]> };
    merchantStockTxn: { findMany: (args: { where: Record<string, unknown> }) => Promise<unknown[]> };
  };
};

homeHarness.__TEST_PRISMA__ = {
  restockRequest: {
    findMany: async (args) => {
      const where = (args.where ?? {}) as {
        merchantId: string;
        status?: { in: string[] };
        shipment?: { status?: string };
      };
      if (where.shipment?.status === 'delivered' && homeWorld.failDeliveredRequests) {
        throw new Error('delivered request query failed');
      }
      let rows = homeWorld.requests.filter((row) => {
        if (row.merchantId !== where.merchantId) return false;
        if (where.status?.in && !where.status.in.includes(row.status)) return false;
        if (where.shipment?.status && row.shipment?.status !== where.shipment.status) return false;
        return true;
      });
      if (where.shipment?.status === 'delivered') {
        rows = [...rows].sort((a, b) => {
          const aTime = a.shipment?.deliveredAt?.getTime() ?? Number.POSITIVE_INFINITY;
          const bTime = b.shipment?.deliveredAt?.getTime() ?? Number.POSITIVE_INFINITY;
          if (aTime !== bTime) return aTime - bTime;
          return (a.shipment?.shipmentNumber ?? '').localeCompare(b.shipment?.shipmentNumber ?? '');
        });
      } else {
        rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      const take = typeof args.take === 'number' ? args.take : rows.length;
      return rows.slice(0, take).map((row) =>
        where.shipment
          ? {
              id: row.id,
              shipment: row.shipment
                ? {
                    id: row.shipment.id,
                    shipmentNumber: row.shipment.shipmentNumber,
                    deliveredAt: row.shipment.deliveredAt ?? null,
                    updatedAt: row.shipment.updatedAt ?? new Date('2026-09-01'),
                  }
                : null,
            }
          : { id: row.id, shipment: row.shipment ? { status: row.shipment.status } : null },
      );
    },
  },
  merchantStock: { findMany: async () => [] },
  refillOrder: { count: async () => 0 },
  shipment: {
    findMany: async (args) => {
      if (homeWorld.failDirect) throw new Error('direct query failed');
      const where = (args.where ?? {}) as Record<string, unknown>;
      const matched = homeWorld.directs.filter((row) => matchesShipmentWhere(row, where));
      const sorted = sortDirects(matched, args.orderBy);
      const take = typeof args.take === 'number' ? args.take : sorted.length;
      return sorted.slice(0, take).map((row) => ({
        id: row.id,
        shipmentNumber: row.shipmentNumber,
        status: row.status,
        deliveredAt: row.deliveredAt,
        updatedAt: row.updatedAt,
        items: row.items,
      }));
    },
  },
  merchantStockTxn: {
    findMany: async ({ where }) => {
      if (homeWorld.failEvidence) throw new Error('evidence failed');
      return homeWorld.stockTxns.filter((txn) => {
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

const homeLoader = `
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

register(`data:text/javascript,${encodeURIComponent(homeLoader)}`, pathToFileURL(import.meta.url));

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

let loadHomeTasks: (typeof import('@/lib/pos/load-today-dashboard'))['loadHomeTasks'];

function resetHomeWorld(overrides: Partial<HomeWorld> = {}): HomeWorld {
  return {
    requests: [],
    directs: [],
    stockTxns: [],
    failDeliveredRequests: false,
    failDirect: false,
    failEvidence: false,
    ...overrides,
  };
}

function requestRow(overrides: Partial<OpenRequest>): OpenRequest {
  return {
    id: 'request-1',
    merchantId: 'merchant-1',
    status: 'converted_to_shipment',
    createdAt: new Date('2026-09-04'),
    shipment: {
      id: 'ship-req-1',
      status: 'delivered',
      shipmentNumber: 'SHP-REQ-0001',
      deliveredAt: new Date('2026-09-05T08:00:00.000Z'),
      updatedAt: new Date('2026-09-05T08:00:00.000Z'),
    },
    ...overrides,
  };
}

function directRow(overrides: Partial<DirectRow> = {}): DirectRow {
  return {
    id: 'ship-direct-1',
    merchantId: 'merchant-1',
    type: 'merchant_restock',
    restockRequestId: null,
    shipmentNumber: 'SHP-DIR-0001',
    status: 'delivered',
    deliveredAt: new Date('2026-09-04T08:00:00.000Z'),
    updatedAt: new Date('2026-09-04T08:00:00.000Z'),
    items: [{ id: 'item-d1', productName: '雞霸', quantity: 2 }],
    ...overrides,
  };
}

function receiptCard(cards: Awaited<ReturnType<typeof loadHomeTasks>>['cards']) {
  return cards.find((card) => card.kind === 'awaiting_restock_receipt');
}

describe('loadHomeTasks awaiting receipt', () => {
  before(async () => {
    moduleApi._load = function patchedLoad(request, parent, isMain) {
      if (isPrismaRequest(String(request))) {
        return { prisma: homeHarness.__TEST_PRISMA__ };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      ({ loadHomeTasks } = await import('@/lib/pos/load-today-dashboard'));
    } finally {
      moduleApi._load = originalLoad;
    }
  });

  it('only request delivered uses restock href', async () => {
    homeWorld = resetHomeWorld({ requests: [requestRow({})] });
    const result = await loadHomeTasks('merchant-1');
    const card = receiptCard(result.cards);
    assert.equal(card?.badge, '1');
    assert.equal(card?.href, '/pos/restock/request-1');
    assert.doesNotMatch(card?.subtitle ?? '', /先處理/);
  });

  it('only unposted direct uses shipment href', async () => {
    homeWorld = resetHomeWorld({ directs: [directRow()] });
    const result = await loadHomeTasks('merchant-1');
    const card = receiptCard(result.cards);
    assert.equal(card?.badge, '1');
    assert.equal(card?.href, '/pos/shipments/ship-direct-1');
  });

  it('mixed sources pick the oldest deliveredAt and keep href/subtitle on that row', async () => {
    homeWorld = resetHomeWorld({
      requests: [requestRow({ shipment: {
        id: 'ship-req-1',
        status: 'delivered',
        shipmentNumber: 'SHP-REQ-0001',
        deliveredAt: new Date('2026-09-06T08:00:00.000Z'),
        updatedAt: new Date('2026-09-06T08:00:00.000Z'),
      } })],
      directs: [directRow({ deliveredAt: new Date('2026-09-04T08:00:00.000Z') })],
    });
    const result = await loadHomeTasks('merchant-1');
    const card = receiptCard(result.cards);
    assert.equal(card?.badge, '2');
    assert.equal(card?.href, '/pos/shipments/ship-direct-1');
    assert.match(card?.subtitle ?? '', /先處理最早送達的 SHP-DIR-0001/);
  });

  it('sorts null deliveredAt last and tie-breaks by shipmentNumber', async () => {
    homeWorld = resetHomeWorld({
      requests: [
        requestRow({
          id: 'request-null',
          shipment: {
            id: 'ship-null',
            status: 'delivered',
            shipmentNumber: 'SHP-NULL-0001',
            deliveredAt: null,
            updatedAt: new Date('2026-09-01'),
          },
        }),
        requestRow({
          id: 'request-b',
          shipment: {
            id: 'ship-b',
            status: 'delivered',
            shipmentNumber: 'SHP-B-0001',
            deliveredAt: new Date('2026-09-05T08:00:00.000Z'),
            updatedAt: new Date('2026-09-05T08:00:00.000Z'),
          },
        }),
        requestRow({
          id: 'request-a',
          shipment: {
            id: 'ship-a',
            status: 'delivered',
            shipmentNumber: 'SHP-A-0001',
            deliveredAt: new Date('2026-09-05T08:00:00.000Z'),
            updatedAt: new Date('2026-09-05T08:00:00.000Z'),
          },
        }),
      ],
    });
    const result = await loadHomeTasks('merchant-1');
    const card = receiptCard(result.cards);
    assert.equal(card?.badge, '3');
    assert.equal(card?.href, '/pos/restock/request-a');
    assert.match(card?.subtitle ?? '', /先處理最早送達的 SHP-A-0001/);
  });

  it('dedupes the same shipment id across request and direct', async () => {
    homeWorld = resetHomeWorld({
      requests: [requestRow({ shipment: {
        id: 'shared-ship',
        status: 'delivered',
        shipmentNumber: 'SHP-SHARE-0001',
        deliveredAt: new Date('2026-09-05T08:00:00.000Z'),
        updatedAt: new Date('2026-09-05T08:00:00.000Z'),
      } })],
      directs: [directRow({ id: 'shared-ship', shipmentNumber: 'SHP-SHARE-0001' })],
    });
    const result = await loadHomeTasks('merchant-1');
    const card = receiptCard(result.cards);
    assert.equal(card?.badge, '1');
    assert.equal(card?.href, '/pos/restock/request-1');
  });

  it('isolates another merchant', async () => {
    homeWorld = resetHomeWorld({
      requests: [requestRow({ merchantId: 'merchant-2' })],
      directs: [directRow({ merchantId: 'merchant-2' })],
    });
    const result = await loadHomeTasks('merchant-1');
    assert.equal(receiptCard(result.cards), undefined);
  });

  it('falls back to openRestocks delivered filter when the dedicated query fails', async () => {
    homeWorld = resetHomeWorld({
      failDeliveredRequests: true,
      requests: [requestRow({})],
    });
    const result = await loadHomeTasks('merchant-1');
    const card = receiptCard(result.cards);
    assert.equal(card?.href, '/pos/restock/request-1');
    assert.equal(card?.subtitle, '確認品項與數量正確後，商品才會加入可售庫存');
    assert.equal(result.warning, '部分資料暫時讀取失敗，請稍後再試。');
  });

  it('keeps request cards and warns when the direct query fails', async () => {
    homeWorld = resetHomeWorld({
      failDirect: true,
      requests: [requestRow({})],
      directs: [directRow()],
    });
    const result = await loadHomeTasks('merchant-1');
    const card = receiptCard(result.cards);
    assert.equal(card?.href, '/pos/restock/request-1');
    assert.equal(card?.badge, '1');
    assert.equal(result.warning, '部分資料暫時讀取失敗，請稍後再試。');
  });

  it('treats evidence failure as all directs still awaiting and warns', async () => {
    homeWorld = resetHomeWorld({
      failEvidence: true,
      directs: [directRow()],
      stockTxns: [{ merchantId: 'merchant-1', shipmentItemId: 'item-d1' }],
    });
    const result = await loadHomeTasks('merchant-1');
    const card = receiptCard(result.cards);
    assert.equal(card?.href, '/pos/shipments/ship-direct-1');
    assert.equal(card?.badge, '1');
    assert.equal(result.warning, '部分資料暫時讀取失敗，請稍後再試。');
  });

  it('keeps + after evidence filters a 20-row direct batch', async () => {
    const directs = Array.from({ length: 20 }, (_, index) =>
      directRow({
        id: `ship-direct-${index}`,
        shipmentNumber: `SHP-DIR-${String(index).padStart(4, '0')}`,
        deliveredAt: new Date(Date.UTC(2026, 8, 1 + (index % 10))),
        items: [{ id: `item-${index}`, productName: '雞霸', quantity: 1 }],
      }),
    );
    homeWorld = resetHomeWorld({
      directs,
      stockTxns: [{ merchantId: 'merchant-1', shipmentItemId: 'item-0' }],
    });
    const result = await loadHomeTasks('merchant-1');
    const card = receiptCard(result.cards);
    assert.equal(card?.badge, '19+');
    assert.equal(card?.badgeUnit, '筆');
  });

  it('hides posted directs from the home card', async () => {
    homeWorld = resetHomeWorld({
      directs: [directRow()],
      stockTxns: [{ merchantId: 'merchant-1', shipmentItemId: 'item-d1' }],
    });
    const result = await loadHomeTasks('merchant-1');
    assert.equal(receiptCard(result.cards), undefined);
  });
});
