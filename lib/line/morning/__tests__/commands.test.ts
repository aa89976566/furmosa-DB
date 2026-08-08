import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseMorningCommand, resolveOffInFrequencyStep } from '../commands';

describe('morning commands', () => {
  it('解析四種內容與頻率', () => {
    assert.deepEqual(parseMorningCommand('寵物笑話'), {
      kind: 'content_mode',
      mode: 'jokes',
    });
    assert.deepEqual(parseMorningCommand('全球寵物新鮮事'), {
      kind: 'content_mode',
      mode: 'news',
    });
    assert.deepEqual(parseMorningCommand('兩種交替'), {
      kind: 'content_mode',
      mode: 'alternate',
    });
    assert.deepEqual(parseMorningCommand('每天'), { kind: 'frequency', frequency: 'daily' });
    assert.deepEqual(parseMorningCommand('平日'), { kind: 'frequency', frequency: 'weekday' });
    assert.deepEqual(parseMorningCommand('每週'), { kind: 'frequency', frequency: 'weekly' });
  });

  it('暫停／停止早安／退訂／恢復／設定', () => {
    assert.equal(parseMorningCommand('暫停早安').kind, 'pause');
    assert.equal(parseMorningCommand('停止早安').kind, 'unsubscribe');
    assert.equal(parseMorningCommand('退訂早安').kind, 'unsubscribe');
    assert.equal(parseMorningCommand('恢復早安').kind, 'resume');
    assert.equal(parseMorningCommand('早安設定').kind, 'settings');
  });

  it('裸「停止」必須澄清，不可直接退訂', () => {
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
});
