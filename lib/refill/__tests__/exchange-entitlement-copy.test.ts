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
      '空瓶平安回店，這一罐有好好完成任務。',
      'NT$99 換口味資格已經開好，可以替毛孩挑下一罐了。',
      `⏰ 記得在 ${REFILL_EXCHANGE_WINDOW_DAYS} 天內使用`,
      `最晚使用日：${preview.expiresDisplay}`,
      `到「${storeName}」出示資格就能換；口味以現場庫存為準。`,
    ]);
    assert.match(preview.expiresDisplay!, /^\d{4}\/\d{2}\/\d{2}$/);
  });

  it('wrong-store copy matches Owner wording', () => {
    const preview = buildExchangeWrongStoreCopy({ storeName });
    assert.equal(preview.mode, EXCHANGE_ENTITLEMENT_PREVIEW_MODE);
    assert.deepEqual(preview.lines, [
      '這罐今天走錯店了。',
      `它原本從「${storeName}」出發，還是要帶回這間店才能換。`,
      '每間店的庫存和紀錄各自管理，走原路回去才不會對錯帳。',
    ]);
  });

  it('expiring / expired builders stay preview-only and accurate', () => {
    const soon = buildExchangeExpiringSoonCopy({ storeName, expiresAt });
    const expired = buildExchangeExpiredCopy({ storeName, expiresAt });
    assert.equal(soon.mode, 'preview-only');
    assert.equal(expired.mode, 'preview-only');
    assert.match(soon.lines.join('\n'), /下一罐還在等你/);
    assert.match(soon.lines.join('\n'), /最晚使用日/);
    assert.match(expired.lines.join('\n'), /已經過期/);
    // 一空瓶一組期限：過期後開「新」期限，不是舊資格重新啟用
    assert.match(expired.lines.join('\n'), /再開一組新的/);
    assert.doesNotMatch(expired.lines.join('\n'), /重新啟用/);
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

    const redeemed = buildExchangeLifecycleCopyPreview({
      storeName,
      activatedAt,
      expiresAt,
      redeemedAt: new Date(activatedAt.getTime() + 2000),
      now: new Date(activatedAt.getTime() + 3000),
    });
    assert.equal(redeemed.lifecycle, 'redeemed');
    assert.match(redeemed.lines.join('\n'), /已經用過了/);
    assert.doesNotMatch(redeemed.lines.join('\n'), /囉/);
  });

  it('join-before window lines include 30-day emphasis', () => {
    const lines = buildJoinBeforeWindowLines().join('\n');
    assert.match(lines, /空瓶交回原店後，記得在/);
    assert.match(lines, /30 天內/);
    assert.match(lines, /把毛孩的下一罐帶回家/);
  });
});
