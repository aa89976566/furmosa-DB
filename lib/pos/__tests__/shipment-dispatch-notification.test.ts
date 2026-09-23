import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  recordMerchantDispatch,
  shouldRecordMerchantDispatch,
  unreadDispatchScope,
  dispatchNoticeScope,
} from '../shipment-dispatch-notification.ts';

describe('merchant shipment dispatch notification', () => {
  it('is emitted only when a merchant restock first enters shipped', () => {
    const base = { type: 'merchant_restock', merchantId: 'store-a', nextStatus: 'shipped' };
    assert.equal(shouldRecordMerchantDispatch({ ...base, previousStatus: 'pending' }), true);
    assert.equal(shouldRecordMerchantDispatch({ ...base, previousStatus: 'packed' }), true);
    assert.equal(shouldRecordMerchantDispatch({ ...base, previousStatus: 'shipped' }), false);
    assert.equal(shouldRecordMerchantDispatch({ ...base, previousStatus: 'delivered' }), true);
    assert.equal(shouldRecordMerchantDispatch({ ...base, previousStatus: 'pending', nextStatus: 'delivered' }), false);
    assert.equal(shouldRecordMerchantDispatch({ ...base, merchantId: null, previousStatus: 'pending' }), false);
    assert.equal(shouldRecordMerchantDispatch({ ...base, type: 'customer_order', previousStatus: 'pending' }), false);
  });

  it('upserts one shipment notice and resets prior reads on re-dispatch', async () => {
    const calls: unknown[] = [];
    const db = {
      merchantNotification: { upsert: async (args: unknown) => {
        calls.push(args);
        return { id: 'notice-a' };
      } },
      merchantNotificationRead: { deleteMany: async (args: unknown) => {
        calls.push(args);
      } },
    };
    const occurredAt = new Date('2026-09-22T15:00:00Z');
    await recordMerchantDispatch(db as unknown as Parameters<typeof recordMerchantDispatch>[0], {
      merchantId: 'store-a', shipmentId: 'shipment-a', occurredAt,
    });
    assert.deepEqual(calls, [
      {
        where: { shipmentId_kind: { shipmentId: 'shipment-a', kind: 'shipment_shipped' } },
        create: {
          merchantId: 'store-a', shipmentId: 'shipment-a', kind: 'shipment_shipped',
          title: '商品已出貨', createdAt: occurredAt,
        },
        update: { createdAt: occurredAt },
        select: { id: true },
      },
      { where: { notificationId: 'notice-a' } },
    ]);
  });

  it('never uses a client-supplied merchant or user to read another store inbox', () => {
    assert.deepEqual(unreadDispatchScope({ merchantId: 'store-a', merchantUserId: 'staff-a' }), {
      merchantId: 'store-a', kind: 'shipment_shipped',
      shipment: {
        merchantId: 'store-a', type: 'merchant_restock',
        status: { in: ['shipped', 'delivered'] },
      },
      reads: { none: { merchantUserId: 'staff-a' } },
    });
    assert.deepEqual(dispatchNoticeScope({ merchantId: 'store-a' }, 'notice-a'), {
      id: 'notice-a', merchantId: 'store-a', kind: 'shipment_shipped',
      shipment: { merchantId: 'store-a', type: 'merchant_restock' },
    });

    const staffA = unreadDispatchScope({ merchantId: 'store-a', merchantUserId: 'staff-a' });
    const staffB = unreadDispatchScope({ merchantId: 'store-a', merchantUserId: 'staff-b' });
    const otherStore = unreadDispatchScope({ merchantId: 'store-b', merchantUserId: 'staff-b' });
    assert.notDeepEqual(staffA.reads, staffB.reads, '每位店員必須有各自的已讀狀態');
    assert.equal(staffA.merchantId, 'store-a');
    assert.equal(staffA.shipment.merchantId, 'store-a');
    assert.equal(otherStore.merchantId, 'store-b');
    assert.equal(otherStore.shipment.merchantId, 'store-b');
  });

  it('shows only in-transit and awaiting-receipt dispatch notifications', () => {
    const scope = unreadDispatchScope({ merchantId: 'store-a', merchantUserId: 'staff-a' });
    assert.deepEqual(scope.shipment.status, { in: ['shipped', 'delivered'] });
    assert.equal(scope.shipment.status.in.includes('pending'), false);
    assert.equal(scope.shipment.status.in.includes('cancelled'), false);
    assert.equal(scope.shipment.status.in.includes('received'), false);
  });

  it('all HQ shipment entrypoints share the transactional notification write', () => {
    const actions = readFileSync(new URL('../../../app/(main)/shipments/actions.ts', import.meta.url), 'utf8');
    assert.match(actions, /markShipmentStatus\(formData: FormData\)[\s\S]*markShipmentStatusInner\(formData\)/);
    assert.match(actions, /markShipmentStatusFromQueue\([\s\S]*markShipmentStatusInner\(formData\)/);
    assert.match(actions, /await tx\.shipment\.update\([\s\S]*await recordMerchantDispatch\(tx/);
    assert.match(actions, /!recordDispatch\s*&&/);
  });

  it('keeps the POS badge read-only and makes receipt a separate action', () => {
    const actions = readFileSync(new URL('../../../app/pos/unread-notification-actions.ts', import.meta.url), 'utf8');
    const inbox = readFileSync(new URL('../merchant-notification-inbox.ts', import.meta.url), 'utf8');
    const ui = readFileSync(new URL('../../../components/pos/page-tools.tsx', import.meta.url), 'utf8');
    assert.match(actions, /loadUnreadNotifications\([\s\S]*loadMerchantNotificationInbox\(session\)/);
    assert.match(actions, /readMerchantNotification\([\s\S]*markMerchantNotificationRead\(session, notificationId\)/);
    assert.match(inbox, /merchantUserId: identity\.merchantUserId/);
    assert.match(inbox, /merchantId: identity\.merchantId/);
    assert.match(inbox, /notification\.shipment\.status === 'delivered'[\s\S]*商品已送達，請確認收貨/);
    assert.match(inbox, /restockRequest[\s\S]*\/pos\/restock\/\$\{notification\.shipment\.restockRequest\.id\}/);
    assert.match(inbox, /\/pos\/shipments\/\$\{notification\.shipment\.id\}/);
    assert.match(ui, /inbox\.unreadCount/);
    assert.match(ui, /sessionStorage\.setItem/);
    assert.match(ui, /NOTIFICATION_LOAD_TIMEOUT_MS = 12_000/);
    assert.match(ui, /Promise\.allSettled/);
    assert.match(ui, /setBusy\(false\)/);
    assert.doesNotMatch(ui, /window\.confirm\(/);
  });
});
