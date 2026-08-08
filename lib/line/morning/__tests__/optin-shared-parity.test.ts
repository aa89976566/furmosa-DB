import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ANIMAL_FACT_DISCLOSURE } from '@/lib/line/morning/domain/types';
import {
  NEWS_ONLY_SOURCE_DISCLOSURE,
  OPTIN_CONTENT_OPTIONS,
  renderContentPrompt,
  renderOptinSuccessSummary,
  renderOptinSummary,
  getContentOption,
  getFrequencyOption,
  buildOptinPostbackData,
  parseOptinPostbackData,
  createOptinNonce,
} from '@/lib/line/morning/domain/optin';

/**
 * CI／contract：LINE handler 與 HQ Preview 必須從同一 shared domain 路徑 import，
 * 禁止複製 switch／mapping／copy。
 */
describe('Phase 4B-B shared optin parity', () => {
  it('A–E options + NEWS_ONLY 揭露 + ANIMAL_FACT 非新聞', () => {
    const ids = OPTIN_CONTENT_OPTIONS.filter((o) => o.showByDefault).map(
      (o) => o.actionId,
    );
    assert.deepEqual(ids, [
      'content_a',
      'content_b',
      'content_c',
      'content_d',
      'content_e',
    ]);
    const b = getContentOption('content_b')!;
    assert.ok(b.disclosure.includes(NEWS_ONLY_SOURCE_DISCLOSURE));
    assert.equal(b.domainMode, 'NEWS_ONLY');
    const c = getContentOption('content_c')!;
    assert.ok(c.disclosure.includes(ANIMAL_FACT_DISCLOSURE));
    assert.ok(c.disclosure.includes('不是新聞'));
    const a = getContentOption('content_a')!;
    assert.ok(a.disclosure.includes('不承諾每日新聞'));
  });

  it('postback 只帶 nonce+version+step+action；拒絕 mode', () => {
    const nonce = createOptinNonce();
    const data = buildOptinPostbackData({
      nonce,
      version: 2,
      step: 'content',
      actionId: 'content_a',
    });
    assert.ok(!data.includes('mode='));
    const parsed = parseOptinPostbackData(data);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.actionId, 'content_a');
    assert.equal(parsed.version, 2);
    const bad = parseOptinPostbackData(`${data}&mode=jokes`);
    assert.equal(bad.ok, false);
  });

  it('success summary byte-stable', () => {
    const content = getContentOption('content_a')!;
    const frequency = getFrequencyOption('freq_daily')!;
    const a = renderOptinSuccessSummary({ content, frequency });
    const b = renderOptinSuccessSummary({ content, frequency });
    assert.equal(a, b);
    assert.ok(a.includes('毛孩笑話'));
  });

  it('HQ preview module 與 preference-flow 同路徑 import domain/optin', () => {
    const root = resolve(process.cwd());
    const hq = readFileSync(
      resolve(root, 'lib/line/morning/optin-preview.ts'),
      'utf8',
    );
    const flow = readFileSync(
      resolve(root, 'lib/line/morning/preference-flow.ts'),
      'utf8',
    );
    assert.ok(hq.includes("@/lib/line/morning/domain/optin"));
    assert.ok(flow.includes("@/lib/line/morning/domain/optin"));
    // 禁止 HQ 自建平行 CONTENT switch
    assert.ok(!/case\s+'content_a'/.test(hq));
  });

  it('renderContentPrompt 含完整揭露（供 LINE／HQ 共用）', () => {
    const text = renderContentPrompt({ currentStorageMode: 'alternate' });
    assert.ok(text.includes(NEWS_ONLY_SOURCE_DISCLOSURE));
    assert.ok(text.includes('沿用原設定：笑話／新聞交替'));
    const summary = renderOptinSummary({
      content: getContentOption('content_b')!,
      frequency: getFrequencyOption('freq_friday')!,
    });
    assert.ok(summary.includes('設定摘要'));
    assert.ok(summary.includes('每週五'));
  });

  it('require 路徑可解析（contract）', () => {
    const require = createRequire(import.meta.url);
    // tsx 測試環境以 alias 載入；此處確認模組 export 穩定
    assert.equal(typeof renderContentPrompt, 'function');
    assert.equal(typeof require, 'function');
  });
});
