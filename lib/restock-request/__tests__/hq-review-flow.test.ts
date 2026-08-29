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
};

type MemoryOptions = {
  failItemProductId?: string;
  failClaim?: boolean;
};

function cloneState(rows: RequestRow[], products: ProductRow[]) {
  return {
    rows: structuredClone(rows),
    products: structuredClone(products),
  };
}

function createMemoryHqReviewDb(
  seed: RequestRow[],
  products: ProductRow[],
  options: MemoryOptions = {},
): HqReviewDb & { snapshot: () => { rows: RequestRow[]; products: ProductRow[] } } {
  let state = cloneState(seed, products);

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
    async $transaction<T>(fn: (tx: typeof api) => Promise<T>): Promise<T> {
      const previous = cloneState(state.rows, state.products);
      try {
        return await fn(api);
      } catch (error) {
        state = previous;
        throw error;
      }
    },
    snapshot() {
      return cloneState(state.rows, state.products);
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
  { id: 'p1', name: '雞胸', sku: 'A1', unit: '包', productCategory: 'JAR_EXCHANGE' },
  { id: 'p2', name: '牛肉', sku: 'A2', unit: '包', productCategory: 'JAR_EXCHANGE' },
  { id: 'p3', name: '注入商品', sku: 'X', unit: '包', productCategory: 'JAR_EXCHANGE' },
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
