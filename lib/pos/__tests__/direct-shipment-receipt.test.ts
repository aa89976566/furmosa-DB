import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { before, describe, it } from 'node:test';

type ShipmentItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  weightGrams: number | null;
  unit: string | null;
};

type ShipmentRow = {
  id: string;
  merchantId: string;
  shipmentNumber: string;
  type: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  packedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  updatedAt: Date;
  restockRequestId: string | null;
  items: ShipmentItem[];
  receivedAt: Date | null;
  receivedByMerchantUserId: string | null;
};

type RequestRow = {
  id: string;
  merchantId: string;
  status: string;
  updatedAt: Date;
  hqNote: string | null;
  items: Array<{ requestedQuantity: number; product: { name: string } }>;
  shipment: ShipmentRow | null;
};

const ITEMS: ShipmentItem[] = [
  {
    id: 'item-1',
    productId: 'product-1',
    productName: '雞霸',
    quantity: 2,
    sku: 'SKU-1',
    weightGrams: null,
    unit: '包',
  },
  {
    id: 'item-2',
    productId: 'product-2',
    productName: '水晶魚',
    quantity: 3,
    sku: 'SKU-2',
    weightGrams: null,
    unit: '包',
  },
];

function baseShipment(overrides: Partial<ShipmentRow> = {}): ShipmentRow {
  return {
    id: 'shipment-1',
    merchantId: 'merchant-1',
    shipmentNumber: 'SHP-TEST-0001',
    type: 'merchant_restock',
    status: 'delivered',
    carrier: '黑貓',
    trackingNumber: '123',
    packedAt: new Date('2026-09-01'),
    shippedAt: new Date('2026-09-02'),
    deliveredAt: new Date('2026-09-03'),
    updatedAt: new Date('2026-09-03'),
    restockRequestId: null,
    items: ITEMS.map((item) => ({ ...item })),
    receivedAt: null,
    receivedByMerchantUserId: null,
    ...overrides,
  };
}

type World = {
  shipment: ShipmentRow;
  requests: RequestRow[];
  inTransaction: boolean;
  stockWrites: Array<Record<string, unknown>>;
  txnWrites: Array<Record<string, unknown>>;
  postedItemIds: string[];
};

function createWorld(overrides: Partial<ShipmentRow> = {}): World {
  return {
    shipment: baseShipment(overrides),
    requests: [],
    inTransaction: false,
    stockWrites: [],
    txnWrites: [],
    postedItemIds: [],
  };
}

let world = createWorld();

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'items') return true;
    if (key === 'restockRequest') {
      return value === null ? !row.restockRequestId : true;
    }
    return row[key] === value;
  });
}

function shipmentView(row: ShipmentRow) {
  return {
    id: row.id,
    merchantId: row.merchantId,
    shipmentNumber: row.shipmentNumber,
    type: row.type,
    status: row.status,
    carrier: row.carrier,
    trackingNumber: row.trackingNumber,
    packedAt: row.packedAt,
    shippedAt: row.shippedAt,
    deliveredAt: row.deliveredAt,
    updatedAt: row.updatedAt,
    items: row.items,
    restockRequest: row.restockRequestId ? { id: row.restockRequestId } : null,
  };
}

function makeShipmentDelegate() {
  return {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      if (!matchesWhere(world.shipment as unknown as Record<string, unknown>, where)) {
        return null;
      }
      return shipmentView(world.shipment);
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      if (!matchesWhere(world.shipment as unknown as Record<string, unknown>, where)) {
        return [];
      }
      return [
        {
          id: world.shipment.id,
          shipmentNumber: world.shipment.shipmentNumber,
          status: world.shipment.status,
          updatedAt: world.shipment.updatedAt,
          items: world.shipment.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
          })),
        },
      ];
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      assert.equal(world.inTransaction, true);
      if (!matchesWhere(world.shipment as unknown as Record<string, unknown>, where)) {
        return { count: 0 };
      }
      Object.assign(world.shipment, data);
      return { count: 1 };
    },
  };
}

function makeTx() {
  return {
    shipment: makeShipmentDelegate(),
    merchantStockTxn: {
      findMany: async ({
        where,
      }: {
        where?: { shipmentItemId?: { in: string[] } };
      }) => {
        if (where?.shipmentItemId) {
          return world.postedItemIds.map((shipmentItemId) => ({ shipmentItemId }));
        }
        return [];
      },
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
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
        world.stockWrites.push(create);
        return { ...create, quantity: create.quantity };
      },
    },
    statusAuditLog: {
      create: async () => ({}),
    },
  };
}

const harness = globalThis as typeof globalThis & {
  __TEST_PRISMA__: {
    $transaction: (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => Promise<unknown>;
    shipment: ReturnType<typeof makeShipmentDelegate>;
    restockRequest: {
      findMany: (args: { where: { merchantId: string } }) => Promise<unknown[]>;
    };
  };
  __TEST_SESSION__: {
    merchantId: string;
    merchantUserId: string;
    username: string;
  };
  __TEST_REDIRECTS__: string[];
  __TEST_REVALIDATES__: string[];
};

harness.__TEST_SESSION__ = {
  merchantId: 'merchant-1',
  merchantUserId: 'merchant-user-1',
  username: 'store01',
};
harness.__TEST_REDIRECTS__ = [];
harness.__TEST_REVALIDATES__ = [];
harness.__TEST_PRISMA__ = {
  $transaction: async (fn) => {
    world.inTransaction = true;
    try {
      return await fn(makeTx());
    } finally {
      world.inTransaction = false;
    }
  },
  shipment: makeShipmentDelegate(),
  restockRequest: {
    findMany: async ({ where }: { where: { merchantId: string } }) =>
      world.requests
        .filter((request) => request.merchantId === where.merchantId)
        .map((request) => ({
          id: request.id,
          status: request.status,
          updatedAt: request.updatedAt,
          hqNote: request.hqNote,
          items: request.items,
          shipment: request.shipment
            ? {
                id: request.shipment.id,
                shipmentNumber: request.shipment.shipmentNumber,
                status: request.shipment.status,
                updatedAt: request.shipment.updatedAt,
                items: request.shipment.items.map((item) => ({
                  productName: item.productName,
                  quantity: item.quantity,
                })),
              }
            : null,
        })),
  },
};

const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (isMock(specifier)) return mockResolved(specifier);
  const resolved = await nextResolve(specifier, context);
  const url = String(resolved.url || '');
  if (url.includes('/lib/prisma.') || url.endsWith('/lib/prisma')) return mockResolved('@/lib/prisma');
  if (url.includes('/lib/merchant-auth')) return mockResolved('@/lib/merchant-auth');
  if (url.includes('next/cache')) return mockResolved('next/cache');
  if (url.includes('next/navigation')) return mockResolved('next/navigation');
  return resolved;
}

function isMock(specifier) {
  return (
    specifier === '@/lib/prisma' ||
    specifier === '@/lib/merchant-auth' ||
    specifier === 'next/cache' ||
    specifier === 'next/navigation'
  );
}

function mockResolved(specifier) {
  if (specifier === '@/lib/prisma') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export const prisma = globalThis.__TEST_PRISMA__;',
    };
  }
  if (specifier === '@/lib/merchant-auth') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export async function requireMerchantSession(){return globalThis.__TEST_SESSION__}',
    };
  }
  if (specifier === 'next/cache') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export function revalidatePath(path){globalThis.__TEST_REVALIDATES__.push(String(path))}',
    };
  }
  return {
    shortCircuit: true,
    url: 'data:text/javascript,export function redirect(url){globalThis.__TEST_REDIRECTS__.push(String(url));const err=new Error("NEXT_REDIRECT");err.digest="NEXT_REDIRECT;replace;"+String(url)+";307;";throw err;}',
  };
}
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, pathToFileURL(import.meta.url));

type NodeModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;
const moduleApi = Module as unknown as { _load: NodeModuleLoad };
const originalLoad = moduleApi._load;

function patchedLoad(this: unknown, request: string, parent: unknown, isMain: boolean) {
  const req = String(request);
  if (req === '@/lib/prisma' || req.endsWith('/lib/prisma') || req.endsWith('/lib/prisma.ts') || req.includes('/lib/prisma.')) {
    return { prisma: harness.__TEST_PRISMA__ };
  }
  if (req === '@/lib/merchant-auth' || req.endsWith('/lib/merchant-auth') || req.includes('/merchant-auth/index')) {
    return {
      requireMerchantSession: async () => harness.__TEST_SESSION__,
    };
  }
  if (req === 'next/cache' || req.endsWith('/next/cache')) {
    return {
      revalidatePath: (path: string) => {
        harness.__TEST_REVALIDATES__.push(String(path));
      },
    };
  }
  if (req === 'next/navigation' || req.endsWith('/next/navigation')) {
    return {
      redirect: (url: string) => {
        harness.__TEST_REDIRECTS__.push(String(url));
        const err = new Error('NEXT_REDIRECT') as Error & { digest: string };
        err.digest = `NEXT_REDIRECT;replace;${url};307;`;
        throw err;
      },
    };
  }
  return originalLoad.call(this, req, parent, isMain);
}

let loadMerchantRestockShipment: (typeof import('@/lib/pos/load-merchant-restock-shipment'))['loadMerchantRestockShipment'];
let loadMerchantEvents: (typeof import('@/lib/pos/load-merchant-events'))['loadMerchantEvents'];
let confirmDirectShipmentReceiptAction: (typeof import('@/app/pos/shipments/[id]/actions'))['confirmDirectShipmentReceiptAction'];

function formDataWith(shipmentId: string, extra?: Record<string, string>) {
  const formData = new FormData();
  formData.set('shipmentId', shipmentId);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) formData.set(key, value);
  }
  return formData;
}

async function runAction(formData: FormData) {
  try {
    await confirmDirectShipmentReceiptAction(formData);
    return null;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      String((error as { digest: string }).digest).startsWith('NEXT_REDIRECT')
    ) {
      return harness.__TEST_REDIRECTS__.at(-1) ?? null;
    }
    throw error;
  }
}

describe('HQ 直接 merchant_restock 出貨 POS 入口', () => {
  before(async () => {
    moduleApi._load = patchedLoad as NodeModuleLoad;
    try {
      ({ loadMerchantRestockShipment } = await import('@/lib/pos/load-merchant-restock-shipment'));
      ({ loadMerchantEvents } = await import('@/lib/pos/load-merchant-events'));
      ({ confirmDirectShipmentReceiptAction } = await import('@/app/pos/shipments/[id]/actions'));
    } finally {
      moduleApi._load = originalLoad;
    }
  });

  it('同店無 RestockRequest 的 delivered 出貨成功收貨且庫存只增加一次', async () => {
    world = createWorld();
    harness.__TEST_SESSION__ = {
      merchantId: 'merchant-1',
      merchantUserId: 'merchant-user-1',
      username: 'store01',
    };
    harness.__TEST_REDIRECTS__ = [];

    const loaded = await loadMerchantRestockShipment('shipment-1', 'merchant-1');
    assert.equal(loaded?.kind, 'direct');

    const redirected = await runAction(formDataWith('shipment-1', { merchantId: 'merchant-2' }));
    assert.equal(redirected, '/pos/shipments/shipment-1?receipt=just_received');
    assert.equal(world.shipment.status, 'received');
    assert.equal(world.stockWrites.length, 2);
    assert.equal(world.txnWrites.length, 2);
    assert.equal(world.shipment.receivedByMerchantUserId, 'merchant-user-1');
  });

  it('重送不重複入庫', async () => {
    world = createWorld();
    harness.__TEST_SESSION__ = {
      merchantId: 'merchant-1',
      merchantUserId: 'merchant-user-1',
      username: 'store01',
    };
    harness.__TEST_REDIRECTS__ = [];

    const first = await runAction(formDataWith('shipment-1'));
    assert.equal(first, '/pos/shipments/shipment-1?receipt=just_received');
    const stockAfterFirst = world.stockWrites.length;
    const txnAfterFirst = world.txnWrites.length;
    const second = await runAction(formDataWith('shipment-1'));
    assert.equal(second, '/pos/shipments/shipment-1?receipt=already_received');
    assert.equal(world.stockWrites.length, stockAfterFirst);
    assert.equal(world.txnWrites.length, txnAfterFirst);
    assert.equal(world.shipment.status, 'received');
  });

  it('跨店拒絕', async () => {
    world = createWorld();
    harness.__TEST_SESSION__ = {
      merchantId: 'merchant-2',
      merchantUserId: 'other-user',
      username: 'store02',
    };
    harness.__TEST_REDIRECTS__ = [];

    const cross = await runAction(formDataWith('shipment-1'));
    assert.equal(cross, '/pos/shipments/shipment-1?receipt=failed');
    assert.equal(world.shipment.status, 'delivered');
    assert.equal(world.stockWrites.length, 0);
    assert.equal(world.txnWrites.length, 0);
  });

  it('非 delivered 拒絕', async () => {
    world = createWorld({ status: 'shipped' });
    harness.__TEST_SESSION__ = {
      merchantId: 'merchant-1',
      merchantUserId: 'merchant-user-1',
      username: 'store01',
    };
    harness.__TEST_REDIRECTS__ = [];

    const illegal = await runAction(formDataWith('shipment-1'));
    assert.equal(illegal, '/pos/shipments/shipment-1?receipt=failed');
    assert.equal(world.shipment.status, 'shipped');
    assert.equal(world.stockWrites.length, 0);
    assert.equal(world.txnWrites.length, 0);
  });

  it('linked_request 直接呼叫新 action 時 redirect 舊路由且不入庫', async () => {
    world = createWorld({ restockRequestId: 'request-9' });
    harness.__TEST_SESSION__ = {
      merchantId: 'merchant-1',
      merchantUserId: 'merchant-user-1',
      username: 'store01',
    };
    harness.__TEST_REDIRECTS__ = [];

    const redirected = await runAction(formDataWith('shipment-1'));
    assert.equal(redirected, '/pos/restock/request-9');
    assert.equal(world.shipment.status, 'delivered');
    assert.equal(world.stockWrites.length, 0);
    assert.equal(world.txnWrites.length, 0);
  });

  it('有 RestockRequest 時新路由正確 redirect 到 /pos/restock/[requestId]', async () => {
    world = createWorld({ restockRequestId: 'request-9' });
    const loaded = await loadMerchantRestockShipment('shipment-1', 'merchant-1');
    assert.deepEqual(loaded, { kind: 'linked_request', requestId: 'request-9' });

    const page = readFileSync(new URL('../../../app/pos/shipments/[id]/page.tsx', import.meta.url), 'utf8');
    assert.match(page, /if \(loaded\.kind === 'linked_request'\)/);
    assert.match(page, /redirect\(`\/pos\/restock\/\$\{loaded\.requestId\}`\)/);
    assert.match(page, /loadMerchantRestockShipment\(params\.id, merchantId\)/);
    assert.doesNotMatch(page, /searchParams\?\.merchantId/);
    assert.doesNotMatch(page, /formData\.get\('merchantId'\)/);
  });

  it('direct notification href 指向新路由；既有 RestockRequest href 不變', async () => {
    const requestShipment = baseShipment({
      id: 'shipment-linked',
      shipmentNumber: 'SHP-LINK-0001',
      restockRequestId: 'request-9',
    });
    world = createWorld();
    world.requests = [
      {
        id: 'request-9',
        merchantId: 'merchant-1',
        status: 'converted_to_shipment',
        updatedAt: new Date('2026-09-04'),
        hqNote: null,
        items: [{ requestedQuantity: 1, product: { name: '雞霸' } }],
        shipment: requestShipment,
      },
    ];

    const events = await loadMerchantEvents('merchant-1');
    const linked = events.find((event) => event.id === 'shipment-shipment-linked');
    const direct = events.find((event) => event.id === 'shipment-shipment-1');
    assert.equal(linked?.href, '/pos/restock/request-9');
    assert.equal(direct?.href, '/pos/shipments/shipment-1');
  });
});
