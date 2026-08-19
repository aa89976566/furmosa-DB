import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFlavourLabel,
  REFILL_INTRO_COPY,
  REFILL_INTRO_STEPS,
  REFILL_PLAN_FAQ,
  REFILL_PLAN_RULES,
  DEFAULT_REFILL_FLAVOURS,
} from '../refill-plan-content';
import {
  findRefillCustomerCopyToneViolations,
  REFILL_CUSTOMER_COPY_TONE,
} from '../refill-customer-copy-tone';
import {
  buildExchangeActivatedCopy,
  buildExchangeExpiredCopy,
  buildExchangeExpiringSoonCopy,
  buildExchangeLifecycleCopyPreview,
  buildExchangeWrongStoreCopy,
  buildJoinBeforeWindowLines,
} from '@/lib/refill/exchange-entitlement-copy';
import {
  REFILL_EXCHANGE_WINDOW_COPY,
  computeExchangeExpiresAt,
} from '@/lib/refill/exchange-window';

describe('refill plan content', () => {
  it('keeps formal prices and points rules', () => {
    assert.equal(REFILL_PLAN_RULES.firstJarPrice, 129);
    assert.equal(REFILL_PLAN_RULES.exchangePrice, 99);
    assert.equal(REFILL_PLAN_RULES.pointsPerJar, 1);
    assert.equal(REFILL_PLAN_RULES.pointsForDiscount, 10);
    assert.equal(REFILL_PLAN_RULES.discountAmountDefault, 200);
    assert.match(REFILL_PLAN_RULES.stockDisclaimer, /庫存/);
  });

  it('has seven default flavours', () => {
    assert.equal(DEFAULT_REFILL_FLAVOURS.length, 7);
    assert.equal(formatFlavourLabel('牛肉凍乾', 20), '牛肉凍乾｜20g');
  });

  it('FAQ covers price, empty jar, serial, points, window', () => {
    const joined = REFILL_PLAN_FAQ.map((f) => `${f.question}${f.answer}`).join('\n');
    assert.match(joined, /129/);
    assert.match(joined, /99/);
    assert.match(joined, /空罐|空瓶/);
    assert.match(joined, /8 位/);
    assert.match(joined, /10 點/);
    assert.match(joined, /200/);
    assert.match(joined, /30 天/);
    assert.match(joined, /原店/);
    assert.ok(REFILL_PLAN_FAQ.length >= 10);
    assert.doesNotMatch(joined, /資格自確認起/);
    assert.doesNotMatch(joined, /不可直接領取/);
  });

  it('aligns window days with exchange-window SSOT', () => {
    assert.equal(REFILL_PLAN_RULES.exchangeWindowDays, 30);
    assert.equal(REFILL_PLAN_RULES.expiryReminderDays, 7);
  });

  it('intro CTA labels map to existing message texts', () => {
    assert.equal(REFILL_INTRO_COPY.ctaJoinLabel, '我要參加');
    assert.equal(REFILL_INTRO_COPY.ctaJoinMessage, '開始換罐');
    assert.equal(REFILL_INTRO_COPY.ctaFlavoursLabel, '先看口味');
    assert.equal(REFILL_INTRO_COPY.ctaFlavoursMessage, '看本期口味');
    assert.equal(REFILL_INTRO_COPY.ctaRulesLabel, '查看完整規則');
    assert.equal(REFILL_INTRO_COPY.ctaRulesMessage, '換罐規則');
    assert.equal(REFILL_INTRO_COPY.ctaStores, '查看合作店');
    assert.equal(REFILL_INTRO_COPY.flexTitle, '匠寵換罐計畫');
    assert.equal(REFILL_INTRO_COPY.headline, '這罐吃完，先別急著說再見。');
    assert.equal(REFILL_INTRO_COPY.bodyLines.length, 4);
  });
});

describe('refill customer copy tone gate', () => {
  it('documents tone rules', () => {
    assert.ok(REFILL_CUSTOMER_COPY_TONE.rules.length >= 6);
    assert.match(REFILL_CUSTOMER_COPY_TONE.summary, /Bark/);
  });

  it('customer-visible refill copy avoids banned tone and bureaucracy', () => {
    const storeName = '豬窩寵物美容中和店';
    const activatedAt = new Date('2026-04-01T09:00:00.000+08:00');
    const expiresAt = computeExchangeExpiresAt(activatedAt);
    const redeemed = buildExchangeLifecycleCopyPreview({
      storeName,
      activatedAt,
      expiresAt,
      redeemedAt: new Date(activatedAt.getTime() + 1000),
      now: new Date(activatedAt.getTime() + 2000),
    });

    const texts = [
      REFILL_INTRO_COPY.flexTitle,
      REFILL_INTRO_COPY.headline,
      ...REFILL_INTRO_COPY.bodyLines,
      ...REFILL_INTRO_COPY.flavourSectionLead,
      REFILL_PLAN_RULES.concept,
      REFILL_PLAN_RULES.stockDisclaimer,
      ...REFILL_INTRO_STEPS.map((s) => `${s.title}${s.body}`),
      ...REFILL_PLAN_FAQ.map((f) => `${f.question}${f.answer}`),
      REFILL_EXCHANGE_WINDOW_COPY.highlightLeadBefore,
      REFILL_EXCHANGE_WINDOW_COPY.highlightLeadEmphasis,
      REFILL_EXCHANGE_WINDOW_COPY.highlightLeadAfter,
      REFILL_EXCHANGE_WINDOW_COPY.previewBadge,
      ...buildJoinBeforeWindowLines(),
      ...buildExchangeActivatedCopy({ storeName, expiresAt }).lines,
      ...buildExchangeWrongStoreCopy({ storeName }).lines,
      ...buildExchangeExpiringSoonCopy({ storeName, expiresAt }).lines,
      ...buildExchangeExpiredCopy({ storeName, expiresAt }).lines,
      ...redeemed.lines,
    ];

    const violations = findRefillCustomerCopyToneViolations(texts);
    assert.deepEqual(violations, []);
    assert.doesNotMatch(texts.join('\n'), /小管家/);
    assert.doesNotMatch(texts.join('\n'), /完成核銷|資格派生/);
    assert.doesNotMatch(texts.join('\n'), /重新啟用/);
  });
});
