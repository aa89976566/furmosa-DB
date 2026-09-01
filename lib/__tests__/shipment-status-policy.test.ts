import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  applyMerchantRestockInventoryForStatusChange,
  shouldApplyMerchantRestockInventory,
} from '@/lib/merchant-restock-inventory';
import { buildOrderUpdateFromShipmentStatus } from '@/lib/shipment-order-sync';
import {
  MERCHANT_RESTOCK_DELIVERED_LOCKED_MESSAGE,
  MERCHANT_RESTOCK_SHIPMENT_TYPE,
  SHIPMENT_STATUS_TRANSITIONS,
  allowedNextShipmentStatuses,
  decideShipmentStatusChange,
} from '@/lib/shipment-status-policy';
import { nextStatuses } from '@/lib/shipment';

type Stock = { quantity: number };
type Txn = { note: string };
type Shipment = { type: string; status: string };
type Order = { status: string; fulfillmentStatus: string };

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function runLikeMarkShipmentStatusInner(input: {
  shipment: Shipment;
  order: Order;
  stock: Stock;
  txns: Txn[];
  next: string;
}) {
  const before = {
    shipment: clone(input.shipment),
    order: clone(input.order),
    stock: clone(input.stock),
    txns: clone(input.txns),
  };
  const state = {
    shipment: clone(input.shipment),
    order: clone(input.order),
    stock: clone(input.stock),
    txns: clone(input.txns),
  };

  try {
    const decision = decideShipmentStatusChange({
      type: state.shipment.type,
      status: state.shipment.status,
      next: input.next,
    });
    if (decision.kind === 'noop') {
      return { kind: 'noop' as const, before, after: state };
    }

    state.shipment.status = input.next;
    const orderUpdate = buildOrderUpdateFromShipmentStatus(input.next);
    if (orderUpdate.status) state.order.status = String(orderUpdate.status);
    if (orderUpdate.fulfillmentStatus) {
      state.order.fulfillmentStatus = String(orderUpdate.fulfillmentStatus);
    }
    if (
      shouldApplyMerchantRestockInventory(input.next, state.shipment.type) &&
      !state.txns.some((row) => row.note.includes('SHP-LOCK-1'))
    ) {
      state.stock.quantity += 2;
      state.txns.push({ note: '來自出貨單 SHP-LOCK-1' });
    }
    return { kind: 'apply' as const, before, after: state };
  } catch (error) {
    return {
      kind: 'rejected' as const,
      error: error instanceof Error ? error.message : String(error),
      before,
      after: state,
    };
  }
}

describe('merchant restock delivered cannot leave delivered', () => {
  it('rejects delivered → pending/shipped/packed/cancelled', () => {
    for (const next of ['pending', 'shipped', 'packed', 'cancelled'] as const) {
      assert.throws(
        () =>
          decideShipmentStatusChange({
            type: MERCHANT_RESTOCK_SHIPMENT_TYPE,
            status: 'delivered',
            next,
          }),
        (error: unknown) =>
          error instanceof Error && error.message === MERCHANT_RESTOCK_DELIVERED_LOCKED_MESSAGE,
      );
    }
  });

  it('treats delivered → delivered as no-op', () => {
    const decision = decideShipmentStatusChange({
      type: MERCHANT_RESTOCK_SHIPMENT_TYPE,
      status: 'delivered',
      next: 'delivered',
    });
    assert.deepEqual(decision, { kind: 'noop', next: 'delivered' });
    assert.equal(allowedNextShipmentStatuses(MERCHANT_RESTOCK_SHIPMENT_TYPE, 'delivered').length, 0);
    assert.deepEqual(nextStatuses('delivered', MERCHANT_RESTOCK_SHIPMENT_TYPE), []);
  });

  it('keeps pending → shipped and shipped → delivered allowed', () => {
    assert.deepEqual(
      decideShipmentStatusChange({
        type: MERCHANT_RESTOCK_SHIPMENT_TYPE,
        status: 'pending',
        next: 'shipped',
      }),
      { kind: 'apply', next: 'shipped' },
    );
    assert.deepEqual(
      decideShipmentStatusChange({
        type: MERCHANT_RESTOCK_SHIPMENT_TYPE,
        status: 'shipped',
        next: 'delivered',
      }),
      { kind: 'apply', next: 'delivered' },
    );
    assert.equal(SHIPMENT_STATUS_TRANSITIONS.pending.includes('delivered'), false);
  });

  it('does not change other shipment types delivered rollback', () => {
    assert.deepEqual(
      decideShipmentStatusChange({
        type: 'customer_order',
        status: 'delivered',
        next: 'pending',
      }),
      { kind: 'apply', next: 'pending' },
    );
    assert.deepEqual(
      decideShipmentStatusChange({
        type: 'subscription',
        status: 'delivered',
        next: 'shipped',
      }),
      { kind: 'apply', next: 'shipped' },
    );
    assert.deepEqual(nextStatuses('delivered'), []);
    assert.deepEqual(nextStatuses('delivered', 'customer_order'), []);
  });
});

describe('refusing delivered rollback leaves documents and stock unchanged', () => {
  const deliveredRestock = {
    shipment: { type: MERCHANT_RESTOCK_SHIPMENT_TYPE, status: 'delivered' },
    order: { status: 'delivered', fulfillmentStatus: 'delivered' },
    stock: { quantity: 2 },
    txns: [{ note: '來自出貨單 SHP-LOCK-1' }],
  };

  it('pending/shipped/packed/cancelled refusal does not mutate shipment, order, stock, or txns', async () => {
    for (const next of ['pending', 'shipped', 'packed', 'cancelled'] as const) {
      const result = await runLikeMarkShipmentStatusInner({ ...deliveredRestock, next });
      assert.equal(result.kind, 'rejected');
      if (result.kind !== 'rejected') continue;
      assert.equal(result.error, MERCHANT_RESTOCK_DELIVERED_LOCKED_MESSAGE);
      assert.deepEqual(result.after, result.before);
      assert.equal(result.after.shipment.status, 'delivered');
      assert.equal(result.after.order.status, 'delivered');
      assert.equal(result.after.order.fulfillmentStatus, 'delivered');
      assert.equal(result.after.stock.quantity, 2);
      assert.equal(result.after.txns.length, 1);
    }
  });

  it('repeat delivered does not restock again', async () => {
    const result = await runLikeMarkShipmentStatusInner({
      ...deliveredRestock,
      next: 'delivered',
    });
    assert.equal(result.kind, 'noop');
    assert.deepEqual(result.after, result.before);
    assert.equal(result.after.stock.quantity, 2);
    assert.equal(result.after.txns.length, 1);
    assert.equal(result.after.shipment.status, 'delivered');
    assert.equal(result.after.order.status, 'delivered');
  });
});

describe('pending shipped delivered still follow 0b6b797 stock rules', () => {
  it('pending → shipped does not increase stock', async () => {
    const result = await runLikeMarkShipmentStatusInner({
      shipment: { type: MERCHANT_RESTOCK_SHIPMENT_TYPE, status: 'pending' },
      order: { status: 'confirmed', fulfillmentStatus: 'pending' },
      stock: { quantity: 0 },
      txns: [],
      next: 'shipped',
    });
    assert.equal(result.kind, 'apply');
    assert.equal(result.after.shipment.status, 'shipped');
    assert.equal(result.after.stock.quantity, 0);
    assert.equal(result.after.txns.length, 0);
  });

  it('shipped → delivered stocks once', async () => {
    const first = await runLikeMarkShipmentStatusInner({
      shipment: { type: MERCHANT_RESTOCK_SHIPMENT_TYPE, status: 'shipped' },
      order: { status: 'shipped', fulfillmentStatus: 'shipped' },
      stock: { quantity: 0 },
      txns: [],
      next: 'delivered',
    });
    assert.equal(first.kind, 'apply');
    assert.equal(first.after.shipment.status, 'delivered');
    assert.equal(first.after.stock.quantity, 2);
    assert.equal(first.after.txns.length, 1);

    const second = await runLikeMarkShipmentStatusInner({
      shipment: first.after.shipment,
      order: first.after.order,
      stock: first.after.stock,
      txns: first.after.txns,
      next: 'delivered',
    });
    assert.equal(second.kind, 'noop');
    assert.equal(second.after.stock.quantity, 2);
    assert.equal(second.after.txns.length, 1);
  });
});

describe('detail and queue actions both use the lock before writes', () => {
  const actionsSrc = readFileSync(
    new URL('../../app/(main)/shipments/actions.ts', import.meta.url),
    'utf8',
  );
  const queueSrc = readFileSync(
    new URL('../../components/shipments/shipment-queue-status-select.tsx', import.meta.url),
    'utf8',
  );

  it('both HQ actions call markShipmentStatusInner, which decides before $transaction', () => {
    const innerStart = actionsSrc.indexOf('async function markShipmentStatusInner');
    const decideAt = actionsSrc.indexOf('decideShipmentStatusChange', innerStart);
    const txAt = actionsSrc.indexOf('await prisma.$transaction', innerStart);
    assert.match(actionsSrc, /const result = await markShipmentStatusInner\(formData\);/);
    assert.equal(
      actionsSrc.split('await markShipmentStatusInner(formData)').length - 1,
      2,
    );
    assert.ok(decideAt > innerStart);
    assert.ok(txAt > decideAt);
    assert.match(actionsSrc, /if \(decision\.kind === 'noop'\)/);
    assert.doesNotMatch(actionsSrc, /delivered: \['shipped', 'pending'\]/);
  });

  it('queue UI hides rollback options for delivered merchant restock', () => {
    assert.match(queueSrc, /MERCHANT_RESTOCK_SHIPMENT_TYPE/);
    assert.match(queueSrc, /shipmentType/);
    const lockBlock = queueSrc.slice(
      queueSrc.indexOf('function queueOptionsForStatus'),
      queueSrc.indexOf('statusChipClass'),
    );
    assert.match(lockBlock, /type === MERCHANT_RESTOCK_SHIPMENT_TYPE/);
    assert.match(lockBlock, /value: 'delivered'/);
    assert.doesNotMatch(
      lockBlock.slice(0, lockBlock.indexOf('QUEUE_DELIVERED_OPTIONS')),
      /value: 'pending'/,
    );
  });
});

describe('inventory helper still no-ops when not delivered', () => {
  it('shipped does not apply restock even if called', async () => {
    const posted = await applyMerchantRestockInventoryForStatusChange(
      {
        merchantStockTxn: { count: async () => 0, create: async () => {
          throw new Error('must not create txn');
        } },
        product: { findMany: async () => [] },
        merchantStock: { upsert: async () => {
          throw new Error('must not upsert stock');
        } },
      } as never,
      {
        nextStatus: 'shipped',
        shipmentType: MERCHANT_RESTOCK_SHIPMENT_TYPE,
        shipmentNumber: 'SHP-LOCK-1',
        merchantId: 'mer_1',
        items: [{ productId: 'p1', quantity: 2, weightGrams: null }],
      },
      new Date(),
    );
    assert.equal(posted, false);
  });
});
