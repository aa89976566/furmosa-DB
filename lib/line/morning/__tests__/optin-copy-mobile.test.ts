import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONTENT_MODE_LABELS,
  MORNING_CONTENT_PROMPT,
  MORNING_SETTINGS_MENU,
  MORNING_STOP_CLARIFY,
} from '../copy';
import { buildMorningOptinQuickReplyItems } from '../optin-postback';

/** 粗估：全形字寬約 1ch；按鈕 label 已 ≤20；提示行在 320px 約 16–18 字換行可接受 */
function maxLineLength(text: string): number {
  return Math.max(...text.split('\n').map((l) => l.length));
}

describe('opt-in 文案／按鈕手機寬度', () => {
  it('五選說明含沒新聞時行為；不預設 mixed', () => {
    assert.match(MORNING_CONTENT_PROMPT, /僅毛孩笑話/);
    assert.match(MORNING_CONTENT_PROMPT, /沒有安全新聞就跳過/);
    assert.match(MORNING_CONTENT_PROMPT, /動物冷知識/);
    assert.match(MORNING_CONTENT_PROMPT, /毛孩日常/);
    assert.match(MORNING_CONTENT_PROMPT, /先不用/);
    assert.match(MORNING_CONTENT_PROMPT, /不會預設幫你開混合模式/);
    assert.match(MORNING_CONTENT_PROMPT, /兩種交替.*不會自動升級/);
    assert.match(MORNING_STOP_CLARIFY, /交易通知/);
  });

  it('quick-reply labels 在 320\/375 可點（≤20 字）', () => {
    const { items } = buildMorningOptinQuickReplyItems('U_TEST_m');
    for (const it of items) {
      assert.ok(it.action.label.length <= 20);
    }
  });

  it('設定選單與 labels 覆蓋 FACT mixed', () => {
    assert.match(MORNING_SETTINGS_MENU, /冷知識/);
    assert.equal(
      CONTENT_MODE_LABELS.news_first_fact_fallback,
      '新鮮事；沒有可看冷知識',
    );
    assert.ok(maxLineLength(MORNING_CONTENT_PROMPT) < 80);
  });
});
