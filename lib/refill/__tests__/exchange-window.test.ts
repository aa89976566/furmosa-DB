import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REFILL_EXCHANGE_WINDOW_DAYS,
  REFILL_EXPIRY_REMINDER_DAYS,
  REFILL_EXCHANGE_WINDOW_COPY,
  computeExchangeExpiresAt,
  deriveExchangeEntitlementLifecycle,
  formatExchangeDeadlineDisplay,
  isExchangeEntitlementUsable,
  shouldSendExpiryReminder,
} from '../exchange-window';

describe('exchange-window SSOT', () => {
  it('keeps 30 / 7 day constants', () => {
    assert.equal(REFILL_EXCHANGE_WINDOW_DAYS, 30);
    assert.equal(REFILL_EXPIRY_REMINDER_DAYS, 7);
    assert.match(REFILL_EXCHANGE_WINDOW_COPY.highlightLeadEmphasis, /30 天內/);
    assert.match(REFILL_EXCHANGE_WINDOW_COPY.previewBadge, /Preview/);
  });
});

describe('computeExchangeExpiresAt (Asia/Taipei calendar days)', () => {
  it('adds 30 Taipei calendar days and keeps wall clock', () => {
    const activated = new Date('2026-01-05T10:15:30.123+08:00');
    const expires = computeExchangeExpiresAt(activated);
    assert.equal(expires.toISOString(), new Date('2026-02-04T10:15:30.123+08:00').toISOString());
    assert.equal(formatExchangeDeadlineDisplay(expires), '2026/02/04');
  });

  it('crosses month end (Jan 31 + 30 → Mar 2)', () => {
    const activated = new Date('2026-01-31T23:00:00.000+08:00');
    const expires = computeExchangeExpiresAt(activated);
    assert.equal(formatExchangeDeadlineDisplay(expires), '2026/03/02');
    assert.equal(expires.toISOString(), new Date('2026-03-02T23:00:00.000+08:00').toISOString());
  });

  it('crosses year boundary', () => {
    const activated = new Date('2025-12-20T08:00:00.000+08:00');
    const expires = computeExchangeExpiresAt(activated);
    assert.equal(formatExchangeDeadlineDisplay(expires), '2026/01/19');
  });

  it('handles leap year Feb 29', () => {
    const activated = new Date('2024-02-29T12:00:00.000+08:00');
    const expires = computeExchangeExpiresAt(activated);
    assert.equal(formatExchangeDeadlineDisplay(expires), '2024/03/30');
  });

  it('does not depend on process local TZ for calendar math', () => {
    const activated = new Date('2026-06-01T00:30:00.000+08:00');
    const expires = computeExchangeExpiresAt(activated);
    // Always Taipei +30 calendar days regardless of host TZ
    assert.equal(formatExchangeDeadlineDisplay(expires), '2026/07/01');
  });
});

describe('deriveExchangeEntitlementLifecycle', () => {
  const activatedAt = new Date('2026-03-01T12:00:00.000+08:00');
  const expiresAt = computeExchangeExpiresAt(activatedAt); // 2026-03-31 12:00+08

  it('active just after activation', () => {
    const now = new Date(activatedAt.getTime() + 1000);
    assert.equal(
      deriveExchangeEntitlementLifecycle({ activatedAt, expiresAt, now }),
      'active',
    );
    assert.equal(isExchangeEntitlementUsable({ expiresAt, now }), true);
  });

  it('expiring-soon within 7 days before expiry', () => {
    const now = new Date(expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    assert.equal(
      deriveExchangeEntitlementLifecycle({ activatedAt, expiresAt, now }),
      'expiring-soon',
    );
    assert.equal(isExchangeEntitlementUsable({ expiresAt, now }), true);
    assert.equal(
      shouldSendExpiryReminder({ expiresAt, now, reminderSentAt: null }),
      true,
    );
  });

  it('expiring-soon 1 second before expiry', () => {
    const now = new Date(expiresAt.getTime() - 1000);
    assert.equal(
      deriveExchangeEntitlementLifecycle({ activatedAt, expiresAt, now }),
      'expiring-soon',
    );
    assert.equal(isExchangeEntitlementUsable({ expiresAt, now }), true);
  });

  it('expired at exact expiry instant', () => {
    const now = new Date(expiresAt.getTime());
    assert.equal(
      deriveExchangeEntitlementLifecycle({ activatedAt, expiresAt, now }),
      'expired',
    );
    assert.equal(isExchangeEntitlementUsable({ expiresAt, now }), false);
  });

  it('expired after expiry', () => {
    const now = new Date(expiresAt.getTime() + 1);
    assert.equal(
      deriveExchangeEntitlementLifecycle({ activatedAt, expiresAt, now }),
      'expired',
    );
  });

  it('redeemed wins over time window', () => {
    const now = new Date(activatedAt.getTime() + 1000);
    assert.equal(
      deriveExchangeEntitlementLifecycle({
        activatedAt,
        expiresAt,
        redeemedAt: now,
        now,
      }),
      'redeemed',
    );
    assert.equal(
      isExchangeEntitlementUsable({ expiresAt, redeemedAt: now, now }),
      false,
    );
  });

  it('reminder is idempotent when reminderSentAt set', () => {
    const now = new Date(expiresAt.getTime() - 3 * 24 * 60 * 60 * 1000);
    assert.equal(
      shouldSendExpiryReminder({
        expiresAt,
        now,
        reminderSentAt: new Date(now.getTime() - 1000),
      }),
      false,
    );
  });
});
