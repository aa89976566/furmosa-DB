import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { JIBA_PRODUCT_PICKED, jibaBriefAndUpsell } from '@/lib/campaigns/jiba-two-piece/copy';
import type { JibaProductKey } from '@/lib/campaigns/jiba-two-piece/constants';
import {
  JIBA_SAMPLE_UNBOX_CTA_LABEL,
  JIBA_SAMPLE_UNBOX_IG_URI,
  jibaPostProductPickedMessages,
} from '@/lib/line/campaigns/jiba-unbox/flow';

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

function assertPostProductOrder(productKey: JibaProductKey) {
  const msgs = jibaPostProductPickedMessages(productKey);
  assert.equal(msgs.length, 4, '應為確認、樣本 CTA、投稿說明、「看完了嗎？」共四則');

  assert.equal(msgs[0]?.type, 'text');
  assert.equal(
    (msgs[0] as { text: string }).text,
    JIBA_PRODUCT_PICKED[productKey],
    '第一則須為商品確認文案',
  );

  assert.equal(msgs[1]?.type, 'flex', '第二則須為 Instagram 樣本 CTA Flex');
  const uriAction = findUriAction(msgs[1]);
  assert.ok(uriAction, '樣本 CTA 必須有 URI action');
  assert.equal(uriAction.label, JIBA_SAMPLE_UNBOX_CTA_LABEL);
  assert.equal(uriAction.uri, JIBA_SAMPLE_UNBOX_IG_URI);
  assert.equal(
    JIBA_SAMPLE_UNBOX_CTA_LABEL,
    '看一個開箱樣本',
    'CTA 標籤必須完全一致',
  );
  assert.equal(
    JIBA_SAMPLE_UNBOX_IG_URI,
    'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDk2MzY0MDcwMTc1NjEz?story_media_id=3920692691184160856&igsh=ZzdoZzEwb3A5M2xk',
    'CTA URI 必須完全一致、未改寫',
  );
  const ctaRaw = JSON.stringify(msgs[1]);
  assert.match(ctaRaw, /"type":"uri"/);
  assert.match(ctaRaw, /看一個開箱樣本/);
  assert.ok(
    ctaRaw.includes(JIBA_SAMPLE_UNBOX_IG_URI),
    '完整 Instagram URI 必須藏在 CTA 後方',
  );

  assert.equal(msgs[2]?.type, 'text');
  assert.equal(
    (msgs[2] as { text: string }).text,
    jibaBriefAndUpsell(productKey),
    '第三則須為既有投稿說明／加購文案',
  );

  assert.equal(msgs[3]?.type, 'flex');
  const doneRaw = JSON.stringify(msgs[3]);
  assert.match(doneRaw, /看完了嗎？/);
  assert.match(doneRaw, /好，開始填資料/);
  assert.match(doneRaw, /"type":"message"/);
  assert.doesNotMatch(doneRaw, /看一個開箱樣本/);
}

describe('jibaPostProductPickedMessages — Instagram 開箱樣本 CTA', () => {
  it('選雞霸兩片後：確認 → 樣本 CTA → 投稿說明 → 看完了嗎？', () => {
    assertPostProductOrder('jiba');
  });

  it('選青蛙凍乾後：確認 → 樣本 CTA → 投稿說明 → 看完了嗎？', () => {
    assertPostProductOrder('frog');
  });

  it('共用 builder 對兩種商品都提供相同 CTA 標籤與 URI', () => {
    const jiba = jibaPostProductPickedMessages('jiba');
    const frog = jibaPostProductPickedMessages('frog');
    const jibaUri = findUriAction(jiba[1]);
    const frogUri = findUriAction(frog[1]);
    assert.deepEqual(jibaUri, frogUri);
    assert.equal(jibaUri?.label, '看一個開箱樣本');
    assert.equal(
      jibaUri?.uri,
      'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MDk2MzY0MDcwMTc1NjEz?story_media_id=3920692691184160856&igsh=ZzdoZzEwb3A5M2xk',
    );
  });
});
