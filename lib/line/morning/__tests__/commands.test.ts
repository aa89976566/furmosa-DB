import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMorningCommand, resolveOffInFrequencyStep } from '../commands';

describe('morning commands', () => {
  it('解析五種新 opt-in 與遺留交替', () => {
    assert.deepEqual(parseMorningCommand('僅毛孩笑話'), {
      kind: 'content_mode',
      mode: 'jokes',
    });
    assert.deepEqual(parseMorningCommand('寵物新鮮事；沒有就跳過'), {
      kind: 'content_mode',
      mode: 'news',
    });
    assert.deepEqual(parseMorningCommand('新鮮事；沒有可看冷知識'), {
      kind: 'content_mode',
      mode: 'news_first_fact_fallback',
    });
    assert.deepEqual(parseMorningCommand('新鮮事到日常'), {
      kind: 'content_mode',
      mode: 'news_first_fact_or_humor_fallback',
    });
    assert.deepEqual(parseMorningCommand('兩種交替'), {
      kind: 'content_mode',
      mode: 'alternate',
    });
    assert.deepEqual(parseMorningCommand('每天'), { kind: 'frequency', frequency: 'daily' });
    assert.deepEqual(parseMorningCommand('平日'), { kind: 'frequency', frequency: 'weekday' });
    assert.deepEqual(parseMorningCommand('每週'), { kind: 'frequency', frequency: 'weekly' });
  });

  it('暫停／停止早安／退訂／恢復／設定；交易停止需澄清', () => {
    assert.equal(parseMorningCommand('暫停早安').kind, 'pause');
    assert.equal(parseMorningCommand('停止早安').kind, 'unsubscribe');
    assert.equal(parseMorningCommand('退訂早安').kind, 'unsubscribe');
    assert.equal(parseMorningCommand('恢復早安').kind, 'resume');
    assert.equal(parseMorningCommand('早安設定').kind, 'settings');
    assert.equal(parseMorningCommand('停止').kind, 'bare_stop');
    assert.equal(parseMorningCommand('stop').kind, 'bare_stop');
  });

  it('頻率步驟把先不用解成 frequency=off', () => {
    const cmd = parseMorningCommand('先不用');
    assert.deepEqual(resolveOffInFrequencyStep(cmd), {
      kind: 'frequency',
      frequency: 'off',
    });
  });

  it('舊短語全球寵物新鮮事仍映射 news（NEWS_ONLY）', () => {
    assert.deepEqual(parseMorningCommand('全球寵物新鮮事'), {
      kind: 'content_mode',
      mode: 'news',
    });
  });
});
