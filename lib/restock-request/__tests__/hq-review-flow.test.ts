import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hqRestockInboxBadgeCount,
  hqRestockInboxBucket,
  hqRestockReviewRevalidatePaths,
} from '@/lib/restock-request/hq-inbox';
import {
  RESTOCK_REVIEW_CONFLICT_MESSAGE,
  RestockRequestConflictError,
} from '@/lib/restock-request/review-policy';
import {
  approveAndConvertRestockRequest,
  rejectRestockRequest,
  updateRestockRequestAsHq,
  type HqReviewDb,
} from '@/lib/restock-request/service';
import { restockStatusLabelForMerchant } from '@/lib/restock-request/constants';
import type { CreateRestockOrderInput } from '@/lib/merchant-restock-order';

type ItemRow = {
  id: string;
  restockRequestId: string;
  productId: string;
  requestedQuantity: number | null;
  approvedQuantity: number | null;
};

type RequestRow = {
  id: string;
  merchantId: string;
  status: string;
  shipmentId: string | null;
  merchantNote: string | null;
  hqNote: string | null;
  expectedArrivalDate: Date | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  approvedSnapshot: unknown;
  merchant: {
    name: string;
    contactName: string | null;
    phone: string | null;
    address: string | null;
    preferredCarrier: string | null;
  };
  items: ItemRow[];
};

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  unit: string | null;
  productCategory: string;
  status: string;
};

type StockRow = { merchantId: string; productId: string };
type RuleRow = { merchantId: string; productId: string };

type MemoryOptions = {
  failItemProductId?: string;
  failClaim?: boolean;
  stocks?: StockRow[];
  rules?: RuleRow[];
};

function cloneState(
  rows: RequestRow[],
  products: ProductRow[],
  stocks: StockRow[] = [],
  rules: RuleRow[] = [],
) {
  return {
    rows: structuredClone(rows),
    products: structuredClone(products),
    stocks: structuredClone(stocks),
    rules: structuredClone(rules),
  };
}

function createMemoryHqReviewDb(
  seed: RequestRow[],
  products: ProductRow[],
  options: MemoryOptions = {},
): HqReviewDb & { snapshot: () => { rows: RequestRow[]; products: ProductRow[] } } {
  let state = cloneState(seed, products, options.stocks ?? [], options.rules ?? []);

  const api = {
    restockRequest: {
      async findUnique({ where, include }: { where: { id: string }; include?: object }) {
        const row = state.rows.find((r) => r.id === where.id);
        if (!row) return null;
        const copy = structuredClone(row);
        if (include) return copy;
        return copy;
      },
      async findUniqueOrThrow({ where, include }: { where: { id: string }; include?: object }) {
        const row = await api.restockRequest.findUnique({ where, include });
        if (!row) throw new Error('申請不存在');
        return row;
      },
      async updateMany({
        where,
        data,
      }: {
        where: {
          id: string;
          shipmentId?: null;
          status?: { in: string[] };
        };
        data: Record<string, unknown>;
      }) {
        if (options.failClaim) throw new Error('request status 更新失敗');
        const row = state.rows.find((r) => r.id === where.id);
        if (!row) return { count: 0 };
        if (where.shipmentId === null && row.shipmentId !== null) return { count: 0 };
        if (where.status?.in && !where.status.in.includes(row.status)) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
        include?: object;
      }) {
        const row = state.rows.find((r) => r.id === where.id);
        if (!row) throw new Error('申請不存在');
        Object.assign(row, data);
        return structuredClone(row);
      },
    },
    restockRequestItem: {
      async updateMany({
        where,
        data,
      }: {
        where: { restockRequestId: string; productId: string };
        data: { approvedQuantity: number };
      }) {
        if (options.failItemProductId && where.productId === options.failItemProductId) {
          throw new Error('item 更新失敗');
        }
        const row = state.rows.find((r) => r.id === where.restockRequestId);
        if (!row) return { count: 0 };
        const item = row.items.find((it) => it.productId === where.productId);
        if (!item) return { count: 0 };
        item.approvedQuantity = data.approvedQuantity;
        return { count: 1 };
      },
      async createMany({
        data,
      }: {
        data: Array<{
          restockRequestId: string;
          productId: string;
          requestedQuantity: number | null;
          approvedQuantity: number;
        }>;
      }) {
        for (const line of data) {
          const row = state.rows.find((r) => r.id === line.restockRequestId);
          if (!row) continue;
          row.items.push({
            id: `it_${line.productId}`,
            restockRequestId: line.restockRequestId,
            productId: line.productId,
            requestedQuantity: line.requestedQuantity,
            approvedQuantity: line.approvedQuantity,
          });
        }
        return { count: data.length };
      },
    },
    product: {
      async findMany({ where }: { where: { id: { in: string[] } }; select?: object }) {
        const ids = new Set(where.id.in);
        return state.products.filter((p) => ids.has(p.id));
      },
    },
    merchantStock: {
      async findMany({
        where,
      }: {
        where: { merchantId: string; productId?: { in: string[] } };
      }) {
        return state.stocks.filter((row) => {
          if (row.merchantId !== where.merchantId) return false;
          if (where.productId?.in && !where.productId.in.includes(row.productId)) return false;
          return true;
        });
      },
    },
    merchantProductRule: {
      async findMany({
        where,
      }: {
        where: { merchantId: string; productId?: { in: string[] } };
      }) {
        return state.rules.filter((row) => {
          if (row.merchantId !== where.merchantId) return false;
          if (where.productId?.in && !where.productId.in.includes(row.productId)) return false;
          return true;
        });
      },
    },
    async $transaction<T>(fn: (tx: typeof api) => Promise<T>): Promise<T> {
      const previous = cloneState(state.rows, state.products, state.stocks, state.rules);
      try {
        return await fn(api);
      } catch (error) {
        state = previous;
        throw error;
      }
    },
    snapshot() {
      return cloneState(state.rows, state.products, state.stocks, state.rules);
    },
  };

  return api as unknown as HqReviewDb & {
    snapshot: () => { rows: RequestRow[]; products: ProductRow[] };
  };
}

function sampleRequest(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: 'req_1',
    merchantId: 'm_1',
    status: 'submitted',
    shipmentId: null,
    merchantNote: '缺貨',
    hqNote: null,
    expectedArrivalDate: null,
    approvedByUserId: null,
    approvedAt: null,
    rejectedAt: null,
    approvedSnapshot: null,
    merchant: {
      name: '測試店',
      contactName: '店長',
      phone: '0911111111',
      address: '台北市',
      preferredCarrier: null,
    },
    items: [
      {
        id: 'it_p1',
        restockRequestId: 'req_1',
        productId: 'p1',
        requestedQuantity: 4,
        approvedQuantity: 4,
      },
      {
        id: 'it_p2',
        restockRequestId: 'req_1',
        productId: 'p2',
        requestedQuantity: 2,
        approvedQuantity: 2,
      },
    ],
    ...overrides,
  };
}

const catalog: ProductRow[] = [
  {
    id: 'p1',
    name: '雞胸',
    sku: 'A1',
    unit: '包',
    productCategory: 'JAR_EXCHANGE',
    status: 'active',
  },
  {
    id: 'p2',
    name: '牛肉',
    sku: 'A2',
    unit: '包',
    productCategory: 'JAR_EXCHANGE',
    status: 'active',
  },
  {
    id: 'p3',
    name: '注入商品',
    sku: 'X',
    unit: '包',
    productCategory: 'JAR_EXCHANGE',
    status: 'active',
  },
];

const arrival = new Date('2026-09-01T00:00:00.000Z');

describe('HQ restock review service hardening', () => {
  it('authorized HQ can approve submitted requests via the existing convert shortcut', async () => {
    const db = createMemoryHqReviewDb([sampleRequest()], catalog);
    let shipments = 0;
    const result = await approveAndConvertRestockRequest(
      {
        requestId: 'req_1',
        hqUserId: 'hq_session',
        expectedArrivalDate: arrival,
        hqNote: '可出',
        items: [
          { productId: 'p1', approvedQuantity: 3 },
          { productId: 'p2', approvedQuantity: 1 },
        ],
      },
      {
        db,
        createShipment: async () => {
          shipments += 1;
          return { shipment: { id: 'shp_1' }, order: { id: 'ord_1' } };
        },
      },
    );
    assert.equal(result.idempotent, false);
    assert.equal(result.shipmentId, 'shp_1');
    assert.equal(shipments, 1);
    const row = db.snapshot().rows[0];
    assert.equal(row?.status, 'converted_to_shipment');
    assert.equal(row?.approvedByUserId, 'hq_session');
    assert.equal(row?.items.find((it) => it.productId === 'p1')?.approvedQuantity, 3);
    assert.equal(row?.items.find((it) => it.productId === 'p1')?.requestedQuantity, 4);
  });

  it('rejects extra, duplicate, negative, non-integer, and over-requested quantities', async () => {
    const db = createMemoryHqReviewDb([sampleRequest()], catalog);
    await assert.rejects(
      () =>
        updateRestockRequestAsHq(
          {
            requestId: 'req_1',
            items: [
              { productId: 'p1', approvedQuantity: 1 },
              { productId: 'p2', approvedQuantity: 1 },
              { productId: 'p3', approvedQuantity: 1 },
            ],
          },
          db,
        ),
      /只能審核這張申請上的品項/,
    );
    await assert.rejects(
      () =>
        updateRestockRequestAsHq(
          {
            requestId: 'req_1',
            items: [
              { productId: 'p1', approvedQuantity: 1 },
              { productId: 'p1', approvedQuantity: 2 },
              { productId: 'p2', approvedQuantity: 1 },
            ],
          },
          db,
        ),
      /不能重複/,
    );
    await assert.rejects(
      () =>
        updateRestockRequestAsHq(
          {
            requestId: 'req_1',
            items: [
              { productId: 'p1', approvedQuantity: -1 },
              { productId: 'p2', approvedQuantity: 1 },
            ],
          },
          db,
        ),
      /不可為負/,
    );
    await assert.rejects(
      () =>
        updateRestockRequestAsHq(
          {
            requestId: 'req_1',
            items: [
              { productId: 'p1', approvedQuantity: 1.5 },
              { productId: 'p2', approvedQuantity: 1 },
            ],
          },
          db,
        ),
      /必須是整數/,
    );
    await assert.rejects(
      () =>
        updateRestockRequestAsHq(
          {
            requestId: 'req_1',
            items: [
              { productId: 'p1', approvedQuantity: 9 },
              { productId: 'p2', approvedQuantity: 1 },
            ],
          },
          db,
        ),
      /不能超過店家申請數量/,
    );
    assert.equal(db.snapshot().rows[0]?.status, 'submitted');
  });

  it('rolls back request status when item update fails', async () => {
    const db = createMemoryHqReviewDb([sampleRequest()], catalog, {
      failItemProductId: 'p2',
    });
    await assert.rejects(
      () =>
        updateRestockRequestAsHq(
          {
            requestId: 'req_1',
            hqNote: '試著改',
            items: [
              { productId: 'p1', approvedQuantity: 1 },
              { productId: 'p2', approvedQuantity: 1 },
            ],
          },
          db,
        ),
      /item 更新失敗/,
    );
    const row = db.snapshot().rows[0];
    assert.equal(row?.status, 'submitted');
    assert.equal(row?.hqNote, null);
    assert.equal(row?.items.find((it) => it.productId === 'p1')?.approvedQuantity, 4);
  });

  it('rolls back item updates when request status update fails', async () => {
    const db = createMemoryHqReviewDb([sampleRequest()], catalog, { failClaim: true });
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [
              { productId: 'p1', approvedQuantity: 1 },
              { productId: 'p2', approvedQuantity: 1 },
            ],
          },
          {
            db,
            createShipment: async () => ({ shipment: { id: 'shp_x' }, order: { id: 'ord_x' } }),
          },
        ),
      /request status 更新失敗/,
    );
    const row = db.snapshot().rows[0];
    assert.equal(row?.status, 'submitted');
    assert.equal(row?.items.find((it) => it.productId === 'p1')?.approvedQuantity, 4);
    assert.equal(row?.shipmentId, null);
  });

  it('rolls back approve conversion when shipment creation fails', async () => {
    const db = createMemoryHqReviewDb([sampleRequest()], catalog);
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [
              { productId: 'p1', approvedQuantity: 2 },
              { productId: 'p2', approvedQuantity: 1 },
            ],
          },
          {
            db,
            createShipment: async () => {
              throw new Error('shipment boom');
            },
          },
        ),
      /shipment boom/,
    );
    const row = db.snapshot().rows[0];
    assert.equal(row?.status, 'submitted');
    assert.equal(row?.shipmentId, null);
    assert.equal(row?.items.find((it) => it.productId === 'p1')?.approvedQuantity, 4);
  });

  it('legal reject does not create a shipment or change requested quantity', async () => {
    const db = createMemoryHqReviewDb([sampleRequest()], catalog);
    let shipments = 0;
    await rejectRestockRequest(
      { requestId: 'req_1', hqUserId: 'hq_session', hqNote: '庫存足夠' },
      db,
    );
    const row = db.snapshot().rows[0];
    assert.equal(row?.status, 'rejected');
    assert.equal(row?.items.find((it) => it.productId === 'p1')?.requestedQuantity, 4);
    assert.equal(shipments, 0);
  });

  it('rejected, cancelled, and converted requests cannot be reviewed again', async () => {
    const rejected = createMemoryHqReviewDb([sampleRequest({ status: 'rejected' })], catalog);
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [
              { productId: 'p1', approvedQuantity: 1 },
              { productId: 'p2', approvedQuantity: 1 },
            ],
          },
          { db: rejected, createShipment: async () => ({ shipment: { id: 'x' }, order: { id: 'y' } }) },
        ),
      RestockRequestConflictError,
    );

    const cancelled = createMemoryHqReviewDb([sampleRequest({ status: 'cancelled' })], catalog);
    await assert.rejects(
      () =>
        rejectRestockRequest(
          { requestId: 'req_1', hqUserId: 'hq_session', hqNote: '再拒一次' },
          cancelled,
        ),
      RestockRequestConflictError,
    );
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
          },
          {
            db: cancelled,
            createShipment: async () => ({ shipment: { id: 'x' }, order: { id: 'y' } }),
          },
        ),
      RestockRequestConflictError,
    );

    const converted = createMemoryHqReviewDb(
      [sampleRequest({ status: 'converted_to_shipment', shipmentId: 'shp_old' })],
      catalog,
    );
    const again = await approveAndConvertRestockRequest(
      {
        requestId: 'req_1',
        hqUserId: 'other',
        expectedArrivalDate: arrival,
      },
      {
        db: converted,
        createShipment: async () => {
          throw new Error('must not create another shipment');
        },
      },
    );
    assert.equal(again.idempotent, true);
    assert.equal(again.shipmentId, 'shp_old');
  });

  it('a second HQ submit from a stale page cannot overwrite the first result', async () => {
    const db = createMemoryHqReviewDb([sampleRequest()], catalog);
    let shipments = 0;
    await approveAndConvertRestockRequest(
      {
        requestId: 'req_1',
        hqUserId: 'hq_a',
        expectedArrivalDate: arrival,
        items: [
          { productId: 'p1', approvedQuantity: 2 },
          { productId: 'p2', approvedQuantity: 1 },
        ],
      },
      {
        db,
        createShipment: async () => {
          shipments += 1;
          return { shipment: { id: 'shp_1' }, order: { id: 'ord_1' } };
        },
      },
    );
    await assert.rejects(
      () =>
        rejectRestockRequest(
          { requestId: 'req_1', hqUserId: 'hq_b', hqNote: '舊畫面拒絕' },
          db,
        ),
      (error: unknown) =>
        error instanceof RestockRequestConflictError &&
        error.message === RESTOCK_REVIEW_CONFLICT_MESSAGE,
    );
    const retry = await approveAndConvertRestockRequest(
      {
        requestId: 'req_1',
        hqUserId: 'hq_b',
        expectedArrivalDate: arrival,
      },
      {
        db,
        createShipment: async () => {
          shipments += 1;
          return { shipment: { id: 'shp_dup' }, order: { id: 'ord_dup' } };
        },
      },
    );
    assert.equal(retry.idempotent, true);
    assert.equal(retry.shipmentId, 'shp_1');
    assert.equal(shipments, 1);
    assert.equal(db.snapshot().rows[0]?.status, 'converted_to_shipment');
    assert.equal(db.snapshot().rows[0]?.approvedByUserId, 'hq_a');
  });

  it('successful review moves the request out of the pending badge bucket', async () => {
    assert.equal(hqRestockInboxBucket('submitted'), 'pending');
    assert.equal(hqRestockInboxBadgeCount(1), 1);
    assert.equal(hqRestockInboxBucket('converted_to_shipment'), 'completed');
    assert.equal(hqRestockInboxBucket('rejected'), 'completed');
    assert.equal(hqRestockInboxBadgeCount(0), 0);
  });

  it('POS progress labels stay aligned with HQ statuses', async () => {
    assert.equal(restockStatusLabelForMerchant('submitted'), '公司確認中');
    assert.equal(restockStatusLabelForMerchant('under_review'), '公司確認中');
    assert.equal(restockStatusLabelForMerchant('approved'), '已確認');
    assert.equal(restockStatusLabelForMerchant('rejected'), '需要調整');
    assert.equal(restockStatusLabelForMerchant('converted_to_shipment'), '備貨中');
    assert.equal(restockStatusLabelForMerchant('cancelled'), '已取消');
  });

  it('revalidates inbox, detail, layout path, and POS progress after review', () => {
    assert.deepEqual(hqRestockReviewRevalidatePaths('req_1'), [
      '/restock-requests',
      '/restock-requests/req_1',
      '/pos/restock',
      '/pos/restock/progress',
      '/pos/restock/req_1',
    ]);
  });
});

const standardProduct: ProductRow = {
  id: 'std-1',
  name: '寄賣零食',
  sku: 'STD-1',
  unit: '包',
  productCategory: 'STANDARD',
  status: 'active',
};

const serviceProduct: ProductRow = {
  id: 'svc-1',
  name: '美容',
  sku: 'SVC-1',
  unit: '次',
  productCategory: 'SERVICE',
  status: 'active',
};

function standardRequest(): RequestRow {
  return sampleRequest({
    items: [
      {
        id: 'it_std',
        restockRequestId: 'req_1',
        productId: 'std-1',
        requestedQuantity: 2,
        approvedQuantity: 2,
      },
    ],
  });
}

describe('HQ approve converts eligible STANDARD and JAR_EXCHANGE', () => {
  it('converts an eligible STANDARD request with server merchant, qty, and restock price fields', async () => {
    const db = createMemoryHqReviewDb([standardRequest()], [standardProduct], {
      stocks: [{ merchantId: 'm_1', productId: 'std-1' }],
    });
    let captured: CreateRestockOrderInput | null = null;
    const result = await approveAndConvertRestockRequest(
      {
        requestId: 'req_1',
        hqUserId: 'hq_session',
        expectedArrivalDate: arrival,
        items: [{ productId: 'std-1', approvedQuantity: 2 }],
      },
      {
        db,
        createShipment: async (input) => {
          captured = input;
          return { shipment: { id: 'shp_std' }, order: { id: 'ord_std' } };
        },
      },
    );
    assert.equal(result.idempotent, false);
    assert.equal(result.shipmentId, 'shp_std');
    assert.equal(captured?.merchantId, 'm_1');
    assert.deepEqual(
      captured?.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
      })),
      [{ productId: 'std-1', quantity: 2, unit: '包' }],
    );
    assert.deepEqual(captured?.products, [
      { id: 'std-1', name: '寄賣零食', sku: 'STD-1' },
    ]);
    assert.equal('unitPrice' in (captured?.items[0] ?? {}), false);
    assert.equal(captured?.total, undefined);
    assert.equal(captured?.paymentStatus, undefined);
    const row = db.snapshot().rows[0];
    assert.equal(row?.status, 'converted_to_shipment');
    assert.equal(row?.shipmentId, 'shp_std');
    assert.equal(row?.approvedByUserId, 'hq_session');
    assert.equal(row?.items[0]?.approvedQuantity, 2);
    assert.equal(row?.items[0]?.requestedQuantity, 2);
  });

  it('still converts JAR_EXCHANGE without this store stock', async () => {
    const db = createMemoryHqReviewDb([sampleRequest()], catalog);
    let captured: CreateRestockOrderInput | null = null;
    await approveAndConvertRestockRequest(
      {
        requestId: 'req_1',
        hqUserId: 'hq_session',
        expectedArrivalDate: arrival,
        items: [
          { productId: 'p1', approvedQuantity: 3 },
          { productId: 'p2', approvedQuantity: 1 },
        ],
      },
      {
        db,
        createShipment: async (input) => {
          captured = input;
          return { shipment: { id: 'shp_jar' }, order: { id: 'ord_jar' } };
        },
      },
    );
    assert.equal(captured?.merchantId, 'm_1');
    assert.deepEqual(
      captured?.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      [
        { productId: 'p1', quantity: 3 },
        { productId: 'p2', quantity: 1 },
      ],
    );
    assert.equal('unitPrice' in (captured?.items[0] ?? {}), false);
  });

  it('converts a mixed eligible JAR_EXCHANGE and STANDARD ticket', async () => {
    const db = createMemoryHqReviewDb(
      [
        sampleRequest({
          items: [
            {
              id: 'it_p1',
              restockRequestId: 'req_1',
              productId: 'p1',
              requestedQuantity: 4,
              approvedQuantity: 4,
            },
            {
              id: 'it_std',
              restockRequestId: 'req_1',
              productId: 'std-1',
              requestedQuantity: 2,
              approvedQuantity: 2,
            },
          ],
        }),
      ],
      [...catalog, standardProduct],
      { stocks: [{ merchantId: 'm_1', productId: 'std-1' }] },
    );
    let captured: CreateRestockOrderInput | null = null;
    await approveAndConvertRestockRequest(
      {
        requestId: 'req_1',
        hqUserId: 'hq_session',
        expectedArrivalDate: arrival,
        items: [
          { productId: 'p1', approvedQuantity: 4 },
          { productId: 'std-1', approvedQuantity: 2 },
        ],
      },
      {
        db,
        createShipment: async (input) => {
          captured = input;
          return { shipment: { id: 'shp_mix' }, order: { id: 'ord_mix' } };
        },
      },
    );
    assert.deepEqual(
      captured?.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      [
        { productId: 'p1', quantity: 4 },
        { productId: 'std-1', quantity: 2 },
      ],
    );
    assert.equal(db.snapshot().rows[0]?.shipmentId, 'shp_mix');
  });

  it('rejects inactive, unknown, unsupported, and other-store STANDARD without converting', async () => {
    const inactive = createMemoryHqReviewDb(
      [standardRequest()],
      [{ ...standardProduct, status: 'inactive' }],
      { stocks: [{ merchantId: 'm_1', productId: 'std-1' }] },
    );
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [{ productId: 'std-1', approvedQuantity: 2 }],
          },
          {
            db: inactive,
            createShipment: async () => {
              throw new Error('must not convert');
            },
          },
        ),
      /這項商品目前不能補貨/,
    );
    assert.equal(inactive.snapshot().rows[0]?.status, 'submitted');
    assert.equal(inactive.snapshot().rows[0]?.shipmentId, null);

    const unknown = createMemoryHqReviewDb([standardRequest()], catalog);
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [{ productId: 'std-1', approvedQuantity: 2 }],
          },
          { db: unknown, createShipment: async () => ({ shipment: { id: 'x' }, order: { id: 'y' } }) },
        ),
      /有商品不存在/,
    );

    const serviceReq = sampleRequest({
      items: [
        {
          id: 'it_svc',
          restockRequestId: 'req_1',
          productId: 'svc-1',
          requestedQuantity: 1,
          approvedQuantity: 1,
        },
      ],
    });
    const unsupported = createMemoryHqReviewDb([serviceReq], [serviceProduct]);
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [{ productId: 'svc-1', approvedQuantity: 1 }],
          },
          {
            db: unsupported,
            createShipment: async () => ({ shipment: { id: 'x' }, order: { id: 'y' } }),
          },
        ),
      /這項商品目前不能補貨/,
    );

    const otherStore = createMemoryHqReviewDb([standardRequest()], [standardProduct], {
      stocks: [{ merchantId: 'm_other', productId: 'std-1' }],
      rules: [{ merchantId: 'm_other', productId: 'std-1' }],
    });
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [{ productId: 'std-1', approvedQuantity: 2 }],
          },
          {
            db: otherStore,
            createShipment: async () => ({ shipment: { id: 'x' }, order: { id: 'y' } }),
          },
        ),
      /這項商品目前不能補貨/,
    );
    assert.equal(otherStore.snapshot().rows[0]?.status, 'submitted');
  });

  it('rolls back a mixed illegal ticket and a mid-convert failure', async () => {
    const mixed = createMemoryHqReviewDb(
      [
        sampleRequest({
          items: [
            {
              id: 'it_p1',
              restockRequestId: 'req_1',
              productId: 'p1',
              requestedQuantity: 4,
              approvedQuantity: 4,
            },
            {
              id: 'it_std',
              restockRequestId: 'req_1',
              productId: 'std-1',
              requestedQuantity: 2,
              approvedQuantity: 2,
            },
          ],
        }),
      ],
      [...catalog, standardProduct],
    );
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [
              { productId: 'p1', approvedQuantity: 4 },
              { productId: 'std-1', approvedQuantity: 2 },
            ],
          },
          {
            db: mixed,
            createShipment: async () => {
              throw new Error('must not convert mixed ineligible');
            },
          },
        ),
      /這項商品目前不能補貨/,
    );
    assert.equal(mixed.snapshot().rows[0]?.status, 'submitted');
    assert.equal(mixed.snapshot().rows[0]?.shipmentId, null);

    const midFail = createMemoryHqReviewDb([standardRequest()], [standardProduct], {
      stocks: [{ merchantId: 'm_1', productId: 'std-1' }],
    });
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [{ productId: 'std-1', approvedQuantity: 2 }],
          },
          {
            db: midFail,
            createShipment: async () => {
              throw new Error('shipment boom');
            },
          },
        ),
      /shipment boom/,
    );
    assert.equal(midFail.snapshot().rows[0]?.status, 'submitted');
    assert.equal(midFail.snapshot().rows[0]?.shipmentId, null);
  });

  it('returns the same shipment on retry even if the product is later inactive', async () => {
    const db = createMemoryHqReviewDb(
      [sampleRequest({ status: 'converted_to_shipment', shipmentId: 'shp_old' })],
      catalog.map((product) => ({ ...product, status: 'inactive' })),
    );
    const again = await approveAndConvertRestockRequest(
      {
        requestId: 'req_1',
        hqUserId: 'other',
        expectedArrivalDate: arrival,
        items: [
          { productId: 'p1', approvedQuantity: 1 },
          { productId: 'p2', approvedQuantity: 1 },
        ],
      },
      {
        db,
        createShipment: async () => {
          throw new Error('must not create another shipment');
        },
      },
    );
    assert.equal(again.idempotent, true);
    assert.equal(again.shipmentId, 'shp_old');
    assert.equal(db.snapshot().rows[0]?.shipmentId, 'shp_old');
  });

  it('still rejects over-requested quantities on STANDARD convert', async () => {
    const db = createMemoryHqReviewDb([standardRequest()], [standardProduct], {
      stocks: [{ merchantId: 'm_1', productId: 'std-1' }],
    });
    await assert.rejects(
      () =>
        approveAndConvertRestockRequest(
          {
            requestId: 'req_1',
            hqUserId: 'hq_session',
            expectedArrivalDate: arrival,
            items: [{ productId: 'std-1', approvedQuantity: 9 }],
          },
          {
            db,
            createShipment: async () => ({ shipment: { id: 'x' }, order: { id: 'y' } }),
          },
        ),
      /不能超過店家申請數量/,
    );
    assert.equal(db.snapshot().rows[0]?.status, 'submitted');
  });
});

