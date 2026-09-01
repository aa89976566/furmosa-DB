import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Prisma } from '@prisma/client';
import {
  applyMerchantRestockInventoryForStatusChange,
  merchantRestockAlreadyPosted,
  shouldApplyMerchantRestockInventory,
} from '@/lib/merchant-restock-inventory';
import { RESTOCK_SHIPMENT_TRANSITIONS } from '@/lib/pos/domain-contract';

type StockRow = {
  merchantId: string;
  productId: string;
  tierId: string;
  quantity: number;
  lastRestockAt: Date | null;
};

type TxnRow = {
  id: string;
  txnNumber: string;
  merchantId: string;
  productId: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  note: string | null;
};

type ProductRow = {
  id: string;
  productCategory: string;
  priceTiers: Array<{ id: string; weightGrams: number | null; unit: string; unitQty: number }>;
};

type ShipmentRow = {
  id: string;
  status: string;
};

function cloneState(state: {
  stocks: StockRow[];
  txns: TxnRow[];
  products: ProductRow[];
  shipments: ShipmentRow[];
}) {
  return structuredClone(state);
}

function createMemoryDb(options?: {
  products?: ProductRow[];
  stocks?: StockRow[];
  txns?: TxnRow[];
  shipments?: ShipmentRow[];
  failTxnCreate?: boolean;
}) {
  const state = {
    stocks: options?.stocks ? structuredClone(options.stocks) : [],
    txns: options?.txns ? structuredClone(options.txns) : [],
    products: options?.products ? structuredClone(options.products) : [],
    shipments: options?.shipments ? structuredClone(options.shipments) : [],
  };
  let txnSeq = 0;

  function matchesContains(note: string | null, needle: string) {
    return Boolean(note && note.includes(needle));
  }

  const api = {
    merchantStockTxn: {
      count: async ({
        where,
      }: {
        where: { merchantId: string; type: string; note: { contains: string } };
      }) =>
        state.txns.filter(
          (row) =>
            row.merchantId === where.merchantId &&
            row.type === where.type &&
            matchesContains(row.note, where.note.contains),
        ).length,
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: { txnNumber: { startsWith: string } };
        orderBy: { txnNumber: 'desc' };
      }) => {
        const matched = state.txns.filter((row) =>
          row.txnNumber.startsWith(where.txnNumber.startsWith),
        );
        matched.sort((a, b) => b.txnNumber.localeCompare(a.txnNumber));
        if (orderBy.txnNumber !== 'desc') matched.reverse();
        return matched[0] ?? null;
      },
      create: async ({ data }: { data: Omit<TxnRow, 'id'> }) => {
        if (options?.failTxnCreate) throw new Error('txn write failed');
        const row: TxnRow = { id: `txn_${++txnSeq}`, ...data };
        state.txns.push(row);
        return row;
      },
    },
    product: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        state.products.filter((product) => where.id.in.includes(product.id)),
    },
    merchantStock: {
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { merchantId_productId_tierId: { merchantId: string; productId: string; tierId: string } };
        update: { quantity: { increment: number }; lastRestockAt: Date };
        create: StockRow;
      }) => {
        const key = where.merchantId_productId_tierId;
        const existing = state.stocks.find(
          (row) =>
            row.merchantId === key.merchantId &&
            row.productId === key.productId &&
            row.tierId === key.tierId,
        );
        if (!existing) {
          state.stocks.push({ ...create });
          return state.stocks[state.stocks.length - 1]!;
        }
        existing.quantity += update.quantity.increment;
        existing.lastRestockAt = update.lastRestockAt;
        return existing;
      },
    },
    shipment: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: string };
      }) => {
        const row = state.shipments.find((item) => item.id === where.id);
        if (!row) throw new Error('shipment missing');
        row.status = data.status;
        return row;
      },
    },
  };

  return {
    state,
    tx: api as unknown as Prisma.TransactionClient,
    async $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
      const snap = cloneState(state);
      try {
        return await fn(api as unknown as Prisma.TransactionClient);
      } catch (error) {
        state.stocks = snap.stocks;
        state.txns = snap.txns;
        state.products = snap.products;
        state.shipments = snap.shipments;
        throw error;
      }
    },
  };
}

const now = new Date('2026-08-31T03:00:00.000Z');
const merchantId = 'mer_1';
const shipmentNumber = 'SHP-202608-0001';
const standardId = 'prod_standard';
const jarId = 'prod_jar';

const standardProduct: ProductRow = {
  id: standardId,
  productCategory: 'STANDARD',
  priceTiers: [],
};
const jarProduct: ProductRow = {
  id: jarId,
  productCategory: 'JAR_EXCHANGE',
  priceTiers: [],
};

function restockInput(overrides?: Partial<Parameters<typeof applyMerchantRestockInventoryForStatusChange>[1]>) {
  return {
    nextStatus: 'delivered',
    shipmentType: 'merchant_restock',
    shipmentNumber,
    merchantId,
    items: [{ productId: standardId, quantity: 2, weightGrams: null }],
    ...overrides,
  };
}

describe('merchant restock inventory posts only on delivered', () => {
  it('does not treat shipped as store on-hand increase', () => {
    assert.equal(shouldApplyMerchantRestockInventory('pending', 'merchant_restock'), false);
    assert.equal(shouldApplyMerchantRestockInventory('shipped', 'merchant_restock'), false);
    assert.equal(shouldApplyMerchantRestockInventory('delivered', 'merchant_restock'), true);
  });

  it('shipped does not increase MerchantStock or add restock txn', async () => {
    const db = createMemoryDb({
      products: [standardProduct],
      stocks: [
        {
          merchantId,
          productId: standardId,
          tierId: '',
          quantity: 0,
          lastRestockAt: null,
        },
      ],
      shipments: [{ id: 'shp_1', status: 'pending' }],
    });

    const posted = await db.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id: 'shp_1' }, data: { status: 'shipped' } });
      return applyMerchantRestockInventoryForStatusChange(
        tx,
        restockInput({ nextStatus: 'shipped' }),
        now,
      );
    });

    assert.equal(posted, false);
    assert.equal(db.state.shipments[0]?.status, 'shipped');
    assert.equal(db.state.stocks[0]?.quantity, 0);
    assert.equal(db.state.txns.length, 0);
  });

  it('delivered increases on-hand and writes one restock txn', async () => {
    const db = createMemoryDb({
      products: [standardProduct],
      stocks: [
        {
          merchantId,
          productId: standardId,
          tierId: '',
          quantity: 0,
          lastRestockAt: null,
        },
      ],
      shipments: [{ id: 'shp_1', status: 'shipped' }],
    });

    const posted = await db.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id: 'shp_1' }, data: { status: 'delivered' } });
      return applyMerchantRestockInventoryForStatusChange(tx, restockInput(), now);
    });

    assert.equal(posted, true);
    assert.equal(db.state.shipments[0]?.status, 'delivered');
    assert.equal(db.state.stocks[0]?.quantity, 2);
    assert.equal(db.state.txns.length, 1);
    assert.equal(db.state.txns[0]?.type, 'restock');
    assert.equal(db.state.txns[0]?.quantity, 2);
    assert.equal(db.state.txns[0]?.balanceAfter, 2);
    assert.equal(db.state.txns[0]?.note, '來自出貨單 SHP-202608-0001');
  });

  it('repeated delivered does not post a second time', async () => {
    const db = createMemoryDb({
      products: [standardProduct],
      stocks: [
        {
          merchantId,
          productId: standardId,
          tierId: '',
          quantity: 0,
          lastRestockAt: null,
        },
      ],
    });

    await applyMerchantRestockInventoryForStatusChange(db.tx, restockInput(), now);
    const again = await applyMerchantRestockInventoryForStatusChange(db.tx, restockInput(), now);

    assert.equal(again, false);
    assert.equal(db.state.stocks[0]?.quantity, 2);
    assert.equal(db.state.txns.length, 1);
    assert.equal(await merchantRestockAlreadyPosted(db.tx, merchantId, shipmentNumber), true);
  });

  it('legacy shipped posting is treated as already received on later delivered', async () => {
    const db = createMemoryDb({
      products: [standardProduct],
      stocks: [
        {
          merchantId,
          productId: standardId,
          tierId: '',
          quantity: 2,
          lastRestockAt: now,
        },
      ],
      txns: [
        {
          id: 'legacy_1',
          txnNumber: 'MTXN-202608-0001',
          merchantId,
          productId: standardId,
          type: 'restock',
          quantity: 2,
          balanceAfter: 2,
          note: '來自出貨單 SHP-202608-0001',
        },
      ],
    });

    const posted = await applyMerchantRestockInventoryForStatusChange(db.tx, restockInput(), now);
    assert.equal(posted, false);
    assert.equal(db.state.stocks[0]?.quantity, 2);
    assert.equal(db.state.txns.length, 1);
    assert.equal(db.state.txns[0]?.id, 'legacy_1');
  });

  it('rolls back shipment status and stock when txn write fails', async () => {
    const db = createMemoryDb({
      products: [standardProduct],
      stocks: [
        {
          merchantId,
          productId: standardId,
          tierId: '',
          quantity: 0,
          lastRestockAt: null,
        },
      ],
      shipments: [{ id: 'shp_1', status: 'shipped' }],
      failTxnCreate: true,
    });

    await assert.rejects(
      () =>
        db.$transaction(async (tx) => {
          await tx.shipment.update({ where: { id: 'shp_1' }, data: { status: 'delivered' } });
          await applyMerchantRestockInventoryForStatusChange(tx, restockInput(), now);
        }),
      /txn write failed/,
    );

    assert.equal(db.state.shipments[0]?.status, 'shipped');
    assert.equal(db.state.stocks[0]?.quantity, 0);
    assert.equal(db.state.txns.length, 0);
  });

  it('STANDARD and JAR_EXCHANGE both post on delivered only', async () => {
    const db = createMemoryDb({
      products: [standardProduct, jarProduct],
      stocks: [
        { merchantId, productId: standardId, tierId: '', quantity: 0, lastRestockAt: null },
        { merchantId, productId: jarId, tierId: '', quantity: 0, lastRestockAt: null },
      ],
    });
    const mixed = restockInput({
      items: [
        { productId: standardId, quantity: 2, weightGrams: null },
        { productId: jarId, quantity: 1, weightGrams: null },
      ],
    });

    const skipped = await applyMerchantRestockInventoryForStatusChange(
      db.tx,
      { ...mixed, nextStatus: 'shipped' },
      now,
    );
    assert.equal(skipped, false);
    assert.equal(db.state.stocks.find((row) => row.productId === standardId)?.quantity, 0);
    assert.equal(db.state.stocks.find((row) => row.productId === jarId)?.quantity, 0);

    const posted = await applyMerchantRestockInventoryForStatusChange(db.tx, mixed, now);
    assert.equal(posted, true);
    assert.equal(db.state.stocks.find((row) => row.productId === standardId)?.quantity, 2);
    assert.equal(db.state.stocks.find((row) => row.productId === jarId)?.quantity, 1);
    assert.equal(db.state.txns.length, 2);
    assert.deepEqual(
      db.state.txns.map((row) => row.productId).sort(),
      [jarId, standardId],
    );
  });

  it('does not post inventory for customer_order or subscription deliveries', async () => {
    const db = createMemoryDb({
      products: [standardProduct],
      stocks: [
        { merchantId, productId: standardId, tierId: '', quantity: 0, lastRestockAt: null },
      ],
    });

    for (const shipmentType of ['customer_order', 'subscription'] as const) {
      const posted = await applyMerchantRestockInventoryForStatusChange(
        db.tx,
        restockInput({ shipmentType, nextStatus: 'delivered' }),
        now,
      );
      assert.equal(posted, false);
    }
    assert.equal(db.state.stocks[0]?.quantity, 0);
    assert.equal(db.state.txns.length, 0);
    assert.equal(shouldApplyMerchantRestockInventory('delivered', 'customer_order'), false);
    assert.equal(shouldApplyMerchantRestockInventory('delivered', 'subscription'), false);
  });
});

describe('HQ restock delivery wiring and existing transitions', () => {
  const actionsSrc = readFileSync(new URL('../../app/(main)/shipments/actions.ts', import.meta.url), 'utf8');
  const ordersSrc = readFileSync(new URL('../../app/(main)/orders/actions.ts', import.meta.url), 'utf8');
  const subscriptionSrc = readFileSync(
    new URL('../../app/(main)/subscriptions/shipments/actions.ts', import.meta.url),
    'utf8',
  );

  it('posts restock inside the same status-update transaction, only via delivered helper', () => {
    assert.match(actionsSrc, /applyMerchantRestockInventoryForStatusChange/);
    assert.doesNotMatch(actionsSrc, /applyMerchantRestockFromShipment\(/);
    assert.doesNotMatch(actionsSrc, /restock inventory failed after status update/);
    const txBlock = actionsSrc.slice(
      actionsSrc.indexOf('await prisma.$transaction(async (tx) => {'),
      actionsSrc.indexOf('revalidatePath(\'/shipments\')'),
    );
    assert.match(txBlock, /tx\.shipment\.update/);
    assert.match(txBlock, /applyMerchantRestockInventoryForStatusChange/);
    assert.doesNotMatch(txBlock, /next === 'shipped' \|\| next === 'delivered'/);
  });

  it('does not add pending → delivered; HQ still requires shipped first', () => {
    assert.equal(RESTOCK_SHIPMENT_TRANSITIONS.pending.includes('delivered'), false);
    assert.equal(RESTOCK_SHIPMENT_TRANSITIONS.shipped.includes('delivered'), true);
    assert.match(actionsSrc, /decideShipmentStatusChange/);
    assert.doesNotMatch(actionsSrc, /pending: \[[^\]]*delivered/);
  });

  it('locks merchant_restock delivered before the status-update transaction', () => {
    const innerStart = actionsSrc.indexOf('async function markShipmentStatusInner');
    const decideAt = actionsSrc.indexOf('decideShipmentStatusChange', innerStart);
    const txAt = actionsSrc.indexOf('await prisma.$transaction', innerStart);
    assert.ok(decideAt > innerStart && txAt > decideAt);
    assert.match(actionsSrc, /decision\.kind === 'noop'/);
  });

  it('order status and subscription shipment updates do not call merchant restock posting', () => {
    assert.doesNotMatch(ordersSrc, /applyMerchantRestock/);
    assert.doesNotMatch(subscriptionSrc, /applyMerchantRestock/);
    assert.match(ordersSrc, /type: 'customer_order'/);
  });
});
