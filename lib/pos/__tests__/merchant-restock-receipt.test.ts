import assert from 'node:assert/strict';
import Module, { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { before, describe, it } from 'node:test';

type ShipmentRow = {
  id: string;
  merchantId: string | null;
  shipmentNumber: string;
  type: string;
  status: string;
  receivedAt: Date | null;
  receivedByMerchantUserId: string | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    weightGrams: number | null;
  }>;
};

type World = {
  shipment: ShipmentRow;
  inTransaction: boolean;
  transactionCount: number;
  restockRequestTouched: boolean;
  updateManyWheres: Array<Record<string, unknown>>;
  stockWrites: Array<Record<string, unknown>>;
  txnWrites: Array<Record<string, unknown>>;
  auditWrites: Array<Record<string, unknown>>;
  postedItemIds: string[];
};

const SHIPMENT_ITEMS = [
  { id: 'item-1', productId: 'product-1', quantity: 2, weightGrams: null },
  { id: 'item-2', productId: 'product-2', quantity: 3, weightGrams: null },
];

function baseShipment(overrides: Partial<ShipmentRow> = {}): ShipmentRow {
  return {
    id: 'shipment-1',
    merchantId: 'merchant-1',
    shipmentNumber: 'SHP-TEST-0001',
    type: 'merchant_restock',
    status: 'delivered',
    receivedAt: null,
    receivedByMerchantUserId: null,
    items: SHIPMENT_ITEMS.map((item) => ({ ...item })),
    ...overrides,
  };
}

function createWorld(overrides: Partial<ShipmentRow> = {}): World {
  return {
    shipment: baseShipment(overrides),
    inTransaction: false,
    transactionCount: 0,
    restockRequestTouched: false,
    updateManyWheres: [],
    stockWrites: [],
    txnWrites: [],
    auditWrites: [],
    postedItemIds: [],
  };
}

let world = createWorld();

function assertInTransaction() {
  assert.equal(world.inTransaction, true, '寫入必須發生在同一筆 prisma.$transaction 內');
}

function matchesWhere(row: ShipmentRow, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'items') return true;
    return (row as Record<string, unknown>)[key] === value;
  });
}

function makeTx() {
  return {
    shipment: {
      findFirst: async ({
        where,
      }: {
        where: { id?: string; merchantId?: string };
      }) => {
        assertInTransaction();
        if (!matchesWhere(world.shipment, where as Record<string, unknown>)) return null;
        return {
          id: world.shipment.id,
          merchantId: world.shipment.merchantId,
          shipmentNumber: world.shipment.shipmentNumber,
          type: world.shipment.type,
          status: world.shipment.status,
          items: world.shipment.items,
        };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        assertInTransaction();
        world.updateManyWheres.push(where);
        if (!matchesWhere(world.shipment, where)) return { count: 0 };
        Object.assign(world.shipment, data);
        return { count: 1 };
      },
    },
    merchantStockTxn: {
      findMany: async ({
        where,
      }: {
        where?: { shipmentItemId?: { in: string[] }; note?: unknown };
      }) => {
        assertInTransaction();
        if (where?.shipmentItemId) {
          return world.postedItemIds.map((shipmentItemId) => ({ shipmentItemId }));
        }
        return [];
      },
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        assertInTransaction();
        world.txnWrites.push(data);
        if (typeof data.shipmentItemId === 'string') {
          world.postedItemIds.push(data.shipmentItemId);
        }
        return data;
      },
    },
    product: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id, priceTiers: [] })),
    },
    merchantStock: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        assertInTransaction();
        world.stockWrites.push(create);
        return { ...create, quantity: create.quantity };
      },
    },
    statusAuditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        assertInTransaction();
        world.auditWrites.push(data);
        return data;
      },
    },
    restockRequest: new Proxy(
      {},
      {
        get() {
          world.restockRequestTouched = true;
          throw new Error('共用收貨服務不得依賴 RestockRequest');
        },
      },
    ),
  };
}

const harness = globalThis as typeof globalThis & {
  __TEST_PRISMA__: {
    $transaction: (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => Promise<unknown>;
  };
};

harness.__TEST_PRISMA__ = {
  $transaction: async (fn) => {
    world.transactionCount += 1;
    world.inTransaction = true;
    try {
      return await fn(makeTx());
    } finally {
      world.inTransaction = false;
    }
  },
};

const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/prisma') {
    return mockPrisma();
  }
  const resolved = await nextResolve(specifier, context);
  const url = String(resolved.url || '');
  if (url.includes('/lib/prisma.') || url.endsWith('/lib/prisma')) {
    return mockPrisma();
  }
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

let confirmMerchantRestockReceipt: (typeof import('@/lib/merchant-restock-receipt'))['confirmMerchantRestockReceipt'];

const INPUT = {
  shipmentId: 'shipment-1',
  merchantId: 'merchant-1',
  merchantUserId: 'merchant-user-1',
};

describe('店家補貨收貨共用服務', () => {
  before(async () => {
    moduleApi._load = function patchedLoad(request, parent, isMain) {
      if (isPrismaRequest(String(request))) {
        return { prisma: harness.__TEST_PRISMA__ };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      ({ confirmMerchantRestockReceipt } = await import('@/lib/merchant-restock-receipt'));
    } finally {
      moduleApi._load = originalLoad;
    }
  });

  it('成功收貨：同一交易內 delivered→received、入庫與 audit', async () => {
    world = createWorld();

    const result = await confirmMerchantRestockReceipt(INPUT);

    assert.equal(result, 'just_received');
    assert.equal(world.transactionCount, 1);
    assert.equal(world.restockRequestTouched, false);
    assert.equal(world.shipment.status, 'received');
    assert.equal(world.shipment.receivedByMerchantUserId, 'merchant-user-1');
    assert.ok(world.shipment.receivedAt instanceof Date);
    assert.deepEqual(world.updateManyWheres, [
      {
        id: 'shipment-1',
        merchantId: 'merchant-1',
        type: 'merchant_restock',
        status: 'delivered',
      },
    ]);
    assert.equal(world.stockWrites.length, 2);
    assert.deepEqual(
      world.txnWrites.map((row) => row.shipmentItemId),
      ['item-1', 'item-2'],
    );
    assert.equal(world.auditWrites.length, 1);
    assert.deepEqual(world.auditWrites[0], {
      entityType: 'shipment',
      entityId: 'shipment-1',
      previousStatus: 'delivered',
      newStatus: 'received',
      actorType: 'merchant_user',
      actorId: 'merchant-user-1',
      metadataJson: JSON.stringify({ source: 'pos_restock_receipt' }),
    });
  });

  it('重送不重複入庫', async () => {
    world = createWorld();

    const first = await confirmMerchantRestockReceipt(INPUT);
    const stockAfterFirst = world.stockWrites.length;
    const txnAfterFirst = world.txnWrites.length;
    const auditAfterFirst = world.auditWrites.length;

    const second = await confirmMerchantRestockReceipt(INPUT);

    assert.equal(first, 'just_received');
    assert.equal(second, 'already_received');
    assert.equal(world.transactionCount, 2);
    assert.equal(world.stockWrites.length, stockAfterFirst);
    assert.equal(world.txnWrites.length, txnAfterFirst);
    assert.equal(world.auditWrites.length, auditAfterFirst);
    assert.equal(world.shipment.status, 'received');
  });

  it('跨店拒絕', async () => {
    world = createWorld();

    await assert.rejects(
      () =>
        confirmMerchantRestockReceipt({
          ...INPUT,
          merchantId: 'merchant-2',
        }),
      /找不到這張補貨出貨單/,
    );
    assert.equal(world.shipment.status, 'delivered');
    assert.equal(world.updateManyWheres.length, 0);
    assert.equal(world.stockWrites.length, 0);
    assert.equal(world.txnWrites.length, 0);
    assert.equal(world.auditWrites.length, 0);
    assert.equal(world.restockRequestTouched, false);
  });

  it('非法狀態拒絕', async () => {
    world = createWorld({ status: 'shipped' });

    await assert.rejects(
      () => confirmMerchantRestockReceipt(INPUT),
      /尚未送達/,
    );
    assert.equal(world.shipment.status, 'shipped');
    assert.equal(world.updateManyWheres.length, 0);
    assert.equal(world.stockWrites.length, 0);
    assert.equal(world.txnWrites.length, 0);
    assert.equal(world.auditWrites.length, 0);
  });

  it('id 與店家相符但 type 不是 merchant_restock 時視為找不到', async () => {
    world = createWorld({ type: 'customer_order' });

    await assert.rejects(
      () => confirmMerchantRestockReceipt(INPUT),
      /找不到這張補貨出貨單/,
    );
    assert.equal(world.shipment.status, 'delivered');
    assert.equal(world.updateManyWheres.length, 0);
    assert.equal(world.stockWrites.length, 0);
    assert.equal(world.txnWrites.length, 0);
    assert.equal(world.auditWrites.length, 0);
  });
});
