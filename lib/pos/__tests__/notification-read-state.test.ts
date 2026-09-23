import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeSeenNotificationKeys,
  notificationReadKey,
  unreadNotificationKeys,
} from '@/lib/pos/notification-read-state';

describe('POS notification read state', () => {
  const first = { id: 'request-1', occurredAt: '2026-09-23T10:00:00.000Z' };
  const updated = { id: 'request-1', occurredAt: '2026-09-23T11:00:00.000Z' };

  it('uses the update time so a changed notification becomes unread again', () => {
    assert.notEqual(notificationReadKey(first), notificationReadKey(updated));
    assert.deepEqual(unreadNotificationKeys([updated], [notificationReadKey(first)]), [
      notificationReadKey(updated),
    ]);
  });

  it('remembers visible notifications once and keeps the list bounded', () => {
    assert.deepEqual(
      mergeSeenNotificationKeys([notificationReadKey(first)], [first, updated], 2),
      [notificationReadKey(first), notificationReadKey(updated)],
    );
  });
});
