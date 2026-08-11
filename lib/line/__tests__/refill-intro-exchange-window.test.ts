import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildExchangeWindowHighlightBox,
  buildRefillIntroBubblePreview,
} from '../refill-intro-flex';
import { REFILL_EXCHANGE_WINDOW_COPY } from '@/lib/refill/exchange-window';
import { REFILL_PLAN_RULES, DEFAULT_REFILL_FLAVOURS, formatFlavourLabel } from '@/lib/jar-exchange/refill-plan-content';

describe('refill intro exchange-window Flex contract', () => {
  it('highlight box emphasizes 30 days with size/weight/wrap', () => {
    const box = buildExchangeWindowHighlightBox();
    const raw = JSON.stringify(box);
    assert.equal(box.type, 'box');
    assert.match(raw, new RegExp(REFILL_EXCHANGE_WINDOW_COPY.highlightTitle));
    assert.match(raw, /"text":"30 天內"/);
    assert.match(raw, /"size":"xl"/);
    assert.match(raw, /"weight":"bold"/);
    assert.match(raw, /"wrap":true/);
    assert.match(raw, /Preview/);
    // 不可只靠顏色：必須有獨立字級／粗體節點
    assert.match(raw, /"color":"#C46A2F"/);
  });

  it('intro bubble JSON is serializable and includes window block', () => {
    const bubble = buildRefillIntroBubblePreview({
      settings: {
        heroImageUrl: REFILL_PLAN_RULES.heroImagePath,
        firstJarPrice: 129,
        exchangePrice: 99,
        pointsPerJar: 1,
        pointsForDiscount: 10,
        discountAmount: 200,
        flavourUpdateNote: '每兩週更新',
        periodStartedAt: null,
        periodEndedAt: null,
      },
      flavours: DEFAULT_REFILL_FLAVOURS.map((f, i) => ({
        id: `f-${i}`,
        code: f.code,
        name: f.name,
        weightGrams: f.weightGrams,
        imageUrl: null,
        isActive: true,
        availableFrom: null,
        availableUntil: null,
        sortOrder: f.sortOrder,
        label: formatFlavourLabel(f.name, f.weightGrams),
      })),
    });
    const raw = JSON.stringify(bubble);
    assert.equal(bubble.type, 'bubble');
    assert.doesNotThrow(() => JSON.parse(raw));
    assert.match(raw, /換購期限/);
    assert.match(raw, /30 天內/);
    assert.match(raw, /尚未接 live/);
    assert.match(raw, /NT\$129/);
    assert.match(raw, /開始換罐/);
    // 長文案節點皆 wrap，避免手機截字
    assert.match(raw, /啟用後會顯示實際最後使用日/);
  });
});

describe('migration additive contract', () => {
  it('only CREATE new entitlement table / indexes / FKs', () => {
    const sqlPath = join(
      process.cwd(),
      'prisma/migrations/20260811043000_refill_exchange_entitlement/migration.sql',
    );
    const sql = readFileSync(sqlPath, 'utf8');
    const withoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    assert.match(sql, /CREATE TABLE "refill_exchange_entitlements"/);
    assert.match(sql, /returned_jar_code_id/);
    assert.match(sql, /UNIQUE INDEX/);
    assert.match(sql, /ON DELETE RESTRICT/);
    assert.doesNotMatch(withoutComments, /ALTER TABLE "refill_orders"/i);
    assert.doesNotMatch(withoutComments, /old_container_returned_at/i);
    assert.doesNotMatch(withoutComments, /^\s*UPDATE\b/im);
    assert.doesNotMatch(withoutComments, /\bDELETE FROM\b/i);
    assert.doesNotMatch(withoutComments, /\bDROP\b/i);
  });
});
