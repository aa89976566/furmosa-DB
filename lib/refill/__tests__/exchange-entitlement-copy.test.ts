import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXCHANGE_ENTITLEMENT_PREVIEW_MODE,
  buildExchangeActivatedCopy,
  buildExchangeExpiredCopy,
  buildExchangeExpiringSoonCopy,
  buildExchangeLifecycleCopyPreview,
  buildExchangeWrongStoreCopy,
  buildJoinBeforeWindowLines,
} from '../exchange-entitlement-copy';
import {
  REFILL_EXCHANGE_WINDOW_DAYS,
  computeExchangeExpiresAt,
} from '../exchange-window';

describe('exchange entitlement copy (preview-only)', () => {
  const storeName = '豬窩寵物美容中和店';
  const activatedAt = new Date('2026-04-01T09:00:00.000+08:00');
  const expiresAt = computeExchangeExpiresAt(activatedAt);

  it('activated copy matches Owner wording', () => {
    const preview = buildExchangeActivatedCopy({ storeName, expiresAt });
    assert.equal(preview.mode, EXCHANGE_ENTITLEMENT_PREVIEW_MODE);
    assert.equal(preview.kind, 'activated');
    assert.deepEqual(preview.lines, [
      '空瓶安全回家，任務完成。',
      '你的 NT$99 換購資格已經啟用，可以挑一罐不同口味。',
      `⏰ 請在 ${REFILL_EXCHANGE_WINDOW_DAYS} 天內使用`,
      `最後使用日：${preview.expiresDisplay}`,
      `請回到「${storeName}」完成換罐，口味依門市現場庫存為準。`,
    ]);
    assert.match(preview.expiresDisplay!, /^\d{4}\/\d{2}\/\d{2}$/);
  });

  it('wrong-store copy matches Owner wording', () => {
    const preview = buildExchangeWrongStoreCopy({ storeName });
    assert.equal(preview.mode, EXCHANGE_ENTITLEMENT_PREVIEW_MODE);
    assert.deepEqual(preview.lines, [
      '這罐有自己的回家路線。',
      `它是從「${storeName}」出發的，要帶回原店才能完成換罐。`,
      '不是故意刁難，是庫存和換罐紀錄要對得起來。',
    ]);
  });

  it('expiring / expired builders stay preview-only', () => {
    const soon = buildExchangeExpiringSoonCopy({ storeName, expiresAt });
    const expired = buildExchangeExpiredCopy({ storeName, expiresAt });
    assert.equal(soon.mode, 'preview-only');
    assert.equal(expired.mode, 'preview-only');
    assert.match(soon.lines.join('\n'), /即將|快到了/);
    assert.match(expired.lines.join('\n'), /已經到期/);
  });

  it('lifecycle preview routes by derived status', () => {
    const active = buildExchangeLifecycleCopyPreview({
      storeName,
      activatedAt,
      expiresAt,
      now: new Date(activatedAt.getTime() + 1000),
    });
    assert.equal(active.lifecycle, 'active');

    const expired = buildExchangeLifecycleCopyPreview({
      storeName,
      activatedAt,
      expiresAt,
      now: expiresAt,
    });
    assert.equal(expired.lifecycle, 'expired');
  });

  it('join-before window lines include 30-day emphasis', () => {
    const lines = buildJoinBeforeWindowLines().join('\n');
    assert.match(lines, /換購期限/);
    assert.match(lines, /30 天內/);
    assert.match(lines, /原店/);
  });
});
