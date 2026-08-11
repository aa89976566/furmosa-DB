import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFlavourLabel,
  REFILL_INTRO_COPY,
  REFILL_PLAN_FAQ,
  REFILL_PLAN_RULES,
  DEFAULT_REFILL_FLAVOURS,
} from '../refill-plan-content';

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
  });

  it('aligns window days with exchange-window SSOT', () => {
    assert.equal(REFILL_PLAN_RULES.exchangeWindowDays, 30);
    assert.equal(REFILL_PLAN_RULES.expiryReminderDays, 7);
  });

  it('intro CTA labels are concrete', () => {
    assert.equal(REFILL_INTRO_COPY.ctaStart, '開始換罐');
    assert.equal(REFILL_INTRO_COPY.ctaFlavours, '看本期口味');
    assert.equal(REFILL_INTRO_COPY.ctaStores, '查看合作店');
  });
});
