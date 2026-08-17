import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  JIBA_SAMPLE_UNBOX_CTA_LABEL,
  JIBA_SAMPLE_UNBOX_IG_URI,
  jibaSampleUnboxCtaFlex,
} from '@/lib/line/campaigns/jiba-unbox/flow';

const EXACT_CTA_LABEL = '看一個開箱樣本';
const EXACT_CTA_URI =
  'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDk2MzY0MDcwMTc1NjEz?story_media_id=3920692691184160856&igsh=ZzdoZzEwb3A5M2xk';

function findUriAction(msg: unknown): { type?: string; label?: string; uri?: string } | null {
  const walk = (node: unknown): { type?: string; label?: string; uri?: string } | null => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const x of node) {
        const found = walk(x);
        if (found) return found;
      }
      return null;
    }
    const o = node as {
      type?: string;
      action?: { type?: string; label?: string; uri?: string };
      contents?: unknown;
    };
    if (o.type === 'button' && o.action?.type === 'uri') return o.action;
    if (o.contents) {
      const found = walk(o.contents);
      if (found) return found;
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === 'object' && v !== o.contents) {
        const found = walk(v);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(msg);
}

describe('jibaSampleUnboxCtaFlex — Instagram 開箱樣本 CTA', () => {
  it('CTA 標籤與 URI 必須完全一致', () => {
    assert.equal(JIBA_SAMPLE_UNBOX_CTA_LABEL, EXACT_CTA_LABEL);
    assert.equal(JIBA_SAMPLE_UNBOX_IG_URI, EXACT_CTA_URI);

    const flex = jibaSampleUnboxCtaFlex();
    assert.equal(flex.type, 'flex');
    const uriAction = findUriAction(flex);
    assert.ok(uriAction, '必須有 URI action');
    assert.equal(uriAction.label, EXACT_CTA_LABEL);
    assert.equal(uriAction.uri, EXACT_CTA_URI);

    const raw = JSON.stringify(flex);
    assert.match(raw, /"type":"uri"/);
    assert.ok(raw.includes(EXACT_CTA_URI), '完整 Instagram URI 必須藏在 CTA 後方');
    assert.match(raw, /看一個開箱樣本/);
  });

  it('ASK_PRODUCT 選完後：確認 → 樣本 CTA → brief → 看完了嗎？（兩種商品共用同一 inline 陣列）', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/line/campaigns/jiba-unbox/flow.ts'),
      'utf8',
    );

    // 對準選完商品後的 reply 陣列（兩種商品共用同一段）
    const replyMarker = 'await replyJiba(replyToken, lineUserId, [';
    const pickedMarker =
      "{ type: 'text', text: JIBA_PRODUCT_PICKED[productKey] }";
    const replyStart = src.indexOf(pickedMarker);
    assert.ok(replyStart >= 0, '必須保留原本 JIBA_PRODUCT_PICKED 確認訊息');
    const blockStart = src.lastIndexOf(replyMarker, replyStart);
    const blockEnd = src.indexOf('case FLOW_STATE.SHOW_BRIEF:', replyStart);
    assert.ok(blockStart >= 0 && blockEnd > blockStart);
    const askProductBlock = src.slice(blockStart, blockEnd);

    assert.match(askProductBlock, /JIBA_PRODUCT_PICKED\[productKey\]/);
    assert.match(askProductBlock, /jibaSampleUnboxCtaFlex\(\)/);
    assert.match(askProductBlock, /type: 'text', text: brief/);
    assert.match(askProductBlock, /看完了嗎？/);
    assert.match(askProductBlock, /好，開始填資料/);

    const pickedIdx = askProductBlock.indexOf(pickedMarker);
    const ctaIdx = askProductBlock.indexOf('jibaSampleUnboxCtaFlex()');
    const briefIdx = askProductBlock.indexOf("{ type: 'text', text: brief }");
    const doneIdx = askProductBlock.indexOf("title: '看完了嗎？'");
    assert.ok(pickedIdx >= 0 && ctaIdx >= 0 && briefIdx >= 0 && doneIdx >= 0);
    assert.ok(
      pickedIdx < ctaIdx && ctaIdx < briefIdx && briefIdx < doneIdx,
      '順序必須為：確認 → CTA → brief → 看完了嗎？',
    );

    // 既有「看完了嗎？」卡內容仍完整保留在同一 reply 陣列
    assert.match(
      askProductBlock,
      /subtitle: '準備好就開始填收件資料，零食才寄得出發喔。'/,
    );

    // 確認未抽取成 jibaPostProductPickedMessages 重構
    assert.doesNotMatch(src, /jibaPostProductPickedMessages/);
  });
});

