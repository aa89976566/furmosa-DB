import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RegisterResumeAfter } from '../chat-session';
import { buildRefillLaunchMessages, REFILL_READY_HINT } from '../flex-hubs';
import { parseLinePostbackData } from '../flex-menu';

function resumeFromJarRegNext(next: string | null): RegisterResumeAfter | null {
  if (next === 'enter') return 'enter_code';
  if (next === 'refill') return 'start_refill';
  return null;
}

describe('jar_refill registration next-action', () => {
  it('jd=jar_reg&next=refill → start_refill', () => {
    const params = parseLinePostbackData('jd=jar_reg&next=refill');
    assert.equal(params.get('jd'), 'jar_reg');
    assert.equal(resumeFromJarRegNext(params.get('next')), 'start_refill');
  });

  it('jd=jar_reg&next=enter → enter_code', () => {
    const params = parseLinePostbackData('jd=jar_reg&next=enter');
    assert.equal(resumeFromJarRegNext(params.get('next')), 'enter_code');
  });

  it('jd=jar_refill postback data 可解析', () => {
    const params = parseLinePostbackData('jd=jar_refill');
    assert.equal(params.get('jd'), 'jar_refill');
  });

  it('開戶後換罐 CTA 文案含單一開始換罐鍵（有 LIFF 時）', () => {
    const prev = process.env.LINE_LIFF_ID_REFILL;
    try {
      process.env.LINE_LIFF_ID_REFILL = '2009953429-resumeTest';
      const msgs = buildRefillLaunchMessages({
        body: `開戶完成囉\n\n${REFILL_READY_HINT}`,
      });
      const raw = JSON.stringify(msgs);
      assert.match(raw, /開始換罐/);
      assert.match(raw, /liff\.line\.me\/2009953429-resumeTest/);
      // 單一 URI 按鈕卡
      assert.equal((raw.match(/"type":"uri"/g) || []).length, 1);
    } finally {
      if (prev === undefined) delete process.env.LINE_LIFF_ID_REFILL;
      else process.env.LINE_LIFF_ID_REFILL = prev;
    }
  });
});
