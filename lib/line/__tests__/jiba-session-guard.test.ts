import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('jiba / register session guard (unit contracts)', () => {
  it('pausedForRegister JSON 旗標可被辨識', () => {
    const paused = JSON.parse('{"pausedForRegister":true,"storeCandidates":[]}');
    assert.equal(paused.pausedForRegister === true, true);
    const clear = JSON.parse('{"pausedForRegister":false}');
    assert.equal(clear.pausedForRegister === true, false);
  });

  it('開戶選店步驟文案與開箱毛孩名提示不同（避免混用）', async () => {
    const { LINE_PET_NAME_PROMPT } = await import('../line-copy');
    const { JIBA_ASK_PET } = await import('../../campaigns/jiba-two-piece/copy');
    assert.match(LINE_PET_NAME_PROMPT, /毛孩叫什麼名字/);
    assert.match(JIBA_ASK_PET, /開箱的毛孩/);
    assert.notEqual(LINE_PET_NAME_PROMPT, JIBA_ASK_PET);
  });
});
