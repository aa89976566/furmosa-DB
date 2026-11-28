import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { prisma } from '@/lib/prisma';
import { markMissingContainer, verifyOldContainer } from '@/lib/refill/merchant';

const pickup = {
  orderId: 'order-1',
  merchantId: 'merchant-1',
  actorId: 'staff-1',
};

function mockPickup(t: TestContext) {
  const order = {
    id: pickup.orderId,
    merchantId: pickup.merchantId,
    customerId: 'customer-1',
    status: 'paid_waiting_return',
    deliveryMode: 'exchange',
    orderType: 'exchange',
    paidAt: new Date(),
    totalAmount: 99,
    missingContainerNote: null as string | null,
  };
  const audit: { action: string; merchantId: string; actorId: string }[] = [];
  let previousLock = Promise.resolve();

  const orderDelegate = prisma.refillOrder as unknown as { findUnique: () => Promise<typeof order> };
  const database = prisma as unknown as {
    $transaction: (run: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  };
  const originalFind = orderDelegate.findUnique;
  const originalTransaction = database.$transaction;
  t.after(() => {
    orderDelegate.findUnique = originalFind;
    database.$transaction = originalTransaction;
  });
  orderDelegate.findUnique = async () => ({ ...order });
  database.$transaction = async (run) => {
    let releaseLock: (() => void) | undefined;
    const tx = {
      $queryRaw: async (parts: TemplateStringsArray, id: string, merchantId: string) => {
        assert.match(parts.join(' '), /FROM "refill_orders"[\s\S]*FOR UPDATE/);
        const pendingLock = previousLock;
        previousLock = new Promise<void>((resolve) => { releaseLock = resolve; });
        await pendingLock;
        return id === order.id && merchantId === order.merchantId ? [{ id }] : [];
      },
      refillOrder: {
        findUniqueOrThrow: async () => ({ ...order }),
        update: async ({ data }: { data: Partial<typeof order> }) => Object.assign(order, data),
      },
      jarCode: {
        findUnique: async () => ({
          id: 'jar-1',
          redeemedByCustomerId: order.customerId,
          status: 'issued',
          lockedByRefillOrderId: null,
        }),
        update: async () => ({}),
      },
      refillAuditLog: {
        create: async ({ data }: { data: typeof audit[number] }) => audit.push(data),
      },
    };
    try {
      return await run(tx);
    } finally {
      releaseLock?.();
    }
  };

  return { order, audit };
}

test('concurrent repeats of missing-container top-up keep the same unpaid top-up and write one audit', async (t) => {
  const { order, audit } = mockPickup(t);
  const result = { ok: true, choice: 'topup', status: 'awaiting_extra_payment' };
  const [first, repeat] = await Promise.all([
    markMissingContainer({ ...pickup, choice: 'topup' }),
    markMissingContainer({ ...pickup, actorId: 'staff-2', choice: 'topup' }),
  ]);
  assert.deepEqual(first, result);
  assert.deepEqual(repeat, result);
  assert.equal(order.totalAmount, 99);
  assert.equal(order.deliveryMode, 'exchange');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'missing_container_topup');
  assert.equal(audit[0].merchantId, pickup.merchantId);
  assert.equal(audit[0].actorId, pickup.actorId);
  await assert.rejects(markMissingContainer({ ...pickup, choice: 'keep' }), { code: 'INVALID_STATUS' });
});

test('the same order remains eligible for empty-container verification on a later visit', async (t) => {
  const { order, audit } = mockPickup(t);
  await markMissingContainer({ ...pickup, choice: 'keep' });
  await markMissingContainer({ ...pickup, choice: 'keep' });
  assert.equal(order.status, 'paid_waiting_return');
  assert.equal(order.totalAmount, 99);
  assert.equal(order.missingContainerNote, '顧客未帶空罐');
  assert.deepEqual(audit.map((row) => row.action), ['missing_container_keep']);
  await verifyOldContainer({ ...pickup, serialRaw: '10203040' });
  assert.equal(order.status, 'old_container_verified');
  await assert.rejects(markMissingContainer({ ...pickup, choice: 'topup' }), { code: 'INVALID_STATUS' });
});

test('marking a top-up prevents a concurrent empty-container verification from overwriting it', async (t) => {
  const { order, audit } = mockPickup(t);
  const [marked, verified] = await Promise.allSettled([
    markMissingContainer({ ...pickup, choice: 'topup' }),
    verifyOldContainer({ ...pickup, serialRaw: '10203040' }),
  ]);
  assert.equal(marked.status, 'fulfilled');
  assert.equal(verified.status, 'rejected');
  assert.equal(order.status, 'awaiting_extra_payment');
  assert.deepEqual(audit.map((row) => row.action), ['missing_container_topup']);
});

test('another merchant cannot mark an order for top-up', async (t) => {
  const { order, audit } = mockPickup(t);
  await assert.rejects(
    markMissingContainer({ ...pickup, merchantId: 'other-merchant', choice: 'topup' }),
    { code: 'WRONG_STORE' },
  );
  assert.equal(order.status, 'paid_waiting_return');
  assert.equal(audit.length, 0);
});
