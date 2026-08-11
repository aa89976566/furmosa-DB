import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildExchangeWindowHighlightBox,
  buildRefillIntroBubblePreview,
} from '../refill-intro-content';
import { REFILL_EXCHANGE_WINDOW_COPY } from '@/lib/refill/exchange-window';
import {
  REFILL_INTRO_COPY,
  REFILL_PLAN_RULES,
  DEFAULT_REFILL_FLAVOURS,
  formatFlavourLabel,
} from '@/lib/jar-exchange/refill-plan-content';

function countNodes(obj: unknown): number {
  if (obj == null || typeof obj !== 'object') return 0;
  if (Array.isArray(obj)) {
    return 1 + obj.reduce<number>((acc, item) => acc + countNodes(item), 0);
  }
  let n = 1;
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (v && typeof v === 'object') n += countNodes(v);
  }
  return n;
}

function findDecisionContents(bubble: Record<string, unknown>): unknown[] {
  const walk = (node: unknown): unknown[] | null => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    }
    const rec = node as Record<string, unknown>;
    if (
      rec.type === 'box' &&
      Array.isArray(rec.contents) &&
      rec.contents.some(
        (c) =>
          c &&
          typeof c === 'object' &&
          (c as { text?: string }).text === REFILL_INTRO_COPY.headline,
      )
    ) {
      return rec.contents as unknown[];
    }
    for (const v of Object.values(rec)) {
      const found = walk(v);
      if (found) return found;
    }
    return null;
  };
  return walk(bubble) ?? [];
}

describe('refill intro exchange-window Flex contract', () => {
  it('highlight box emphasizes 30 days with size/weight/wrap', () => {
    const box = buildExchangeWindowHighlightBox();
    const raw = JSON.stringify(box);
    assert.equal(box.type, 'box');
    assert.match(raw, new RegExp(REFILL_EXCHANGE_WINDOW_COPY.highlightLeadBefore));
    assert.match(raw, /"text":"30 天內"/);
    assert.match(raw, /"size":"xl"/);
    assert.match(raw, /"weight":"bold"/);
    assert.match(raw, /"wrap":true/);
    assert.match(raw, /Preview/);
    // 不可只靠顏色：必須有獨立字級／粗體節點
    assert.match(raw, /"color":"#C46A2F"/);
  });

  it('join-before decision card: core facts, 3 CTAs, no clutter', () => {
    const bubble = buildRefillIntroBubblePreview({
      settings: {
        firstJarPrice: REFILL_PLAN_RULES.firstJarPrice,
        exchangePrice: REFILL_PLAN_RULES.exchangePrice,
      },
      flavours: DEFAULT_REFILL_FLAVOURS.map((f) => ({
        label: formatFlavourLabel(f.name, f.weightGrams),
      })),
    });
    const raw = JSON.stringify(bubble);
    assert.equal(bubble.type, 'bubble');
    assert.doesNotThrow(() => JSON.parse(raw));

    // 核心四項＋標題副標
    assert.match(raw, /匠寵換罐計畫/);
    assert.match(raw, /吃完，不用說再見/);
    assert.match(raw, /第一罐 NT\$129/);
    assert.match(raw, /空瓶帶回序號所屬原店，下一罐不同口味 NT\$99/);
    assert.match(raw, /每罐累積 1 點，滿 10 點折 NT\$200 美容費/);
    assert.match(raw, /口味依原店當期庫存/);
    assert.match(raw, /30 天內/);

    // 三個 CTA（標籤 vs message）
    assert.match(raw, /"label":"我要參加"/);
    assert.match(raw, /"text":"開始換罐"/);
    assert.match(raw, /"label":"先看口味"/);
    assert.match(raw, /"text":"看本期口味"/);
    assert.match(raw, /"label":"查看完整規則"/);
    assert.match(raw, /"text":"換罐規則"/);

    // 已從主卡移除
    assert.doesNotMatch(raw, /怎麼參加/);
    assert.doesNotMatch(raw, /先帶一罐回家/);
    assert.doesNotMatch(raw, /7 種口味/);
    assert.doesNotMatch(raw, /每兩週更新/);
    assert.doesNotMatch(raw, /這期想吃哪一罐/);
    assert.doesNotMatch(raw, /蔬果凍乾/);
    assert.doesNotMatch(raw, /8 位/);
    assert.doesNotMatch(raw, /查看合作店/);
    assert.doesNotMatch(raw, /帶空罐換新罐/);
    // 庫存說明只留「口味依原店當期庫存」，不含舊 disclaimer 重複句
    assert.doesNotMatch(raw, /依合作店當期庫存為準/);

    const topBlocks = findDecisionContents(bubble);
    assert.equal(topBlocks.length, 7, `expected 7 top blocks, got ${topBlocks.length}`);
    assert.ok(
      countNodes(bubble) < 70,
      `slim card should be under 70 nodes, got ${countNodes(bubble)}`,
    );
  });

  it('long copy nodes keep wrap for 320px phones', () => {
    const bubble = buildRefillIntroBubblePreview({
      settings: { firstJarPrice: 129, exchangePrice: 99 },
      flavours: [],
    });
    const contents = findDecisionContents(bubble);
    for (const node of contents) {
      if (!node || typeof node !== 'object') continue;
      const rec = node as { type?: string; wrap?: boolean; text?: string };
      if (rec.type === 'text' && typeof rec.text === 'string' && rec.text.length > 12) {
        assert.equal(rec.wrap, true, `missing wrap on: ${rec.text.slice(0, 40)}`);
      }
    }
    const highlight = contents.find(
      (n) =>
        n &&
        typeof n === 'object' &&
        (n as { type?: string }).type === 'box' &&
        JSON.stringify(n).includes('30 天內'),
    ) as { contents?: Array<{ wrap?: boolean; text?: string }> } | undefined;
    assert.ok(highlight?.contents?.length);
    for (const part of highlight.contents ?? []) {
      if (part.text) assert.equal(part.wrap, true);
    }
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
