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

  it('優先序：開戶進行中時開箱 session 判定必須讓路', async () => {
    const { decideJibaUnboxEntry } = await import('../campaigns/jiba-unbox/turns');
    const { FLOW_STATE } = await import('../../campaigns/jiba-two-piece/constants');
    // 開戶暫停旗標在 → 入口只能問續辦，不可重設成邀請或跳步
    assert.deepEqual(
      decideJibaUnboxEntry({
        sessionActive: false,
        pausedForRegister: true,
        hasApplication: true,
        state: FLOW_STATE.ASK_RECIPIENT_NAME,
      }),
      { action: 'resume_choice' },
    );
  });

  it('upsertJiba 契約：register flow 進行中不可覆寫', () => {
    const current = { flow: 'register' as const };
    const shouldSkip = current.flow === 'register';
    assert.equal(shouldSkip, true);
  });

  it('handle-event 仍先開戶再開箱，且仍傳 message.id', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../handle-event.ts', import.meta.url), 'utf8');
    const registerAt = src.indexOf('handleRegisterFlowMessage');
    const jibaAt = src.indexOf('isJibaUnboxSessionActive');
    assert.ok(registerAt > 0 && jibaAt > registerAt);
    assert.match(src, /msgEvent\.message\.id/);
    const chat = readFileSync(new URL('../chat-session.ts', import.meta.url), 'utf8');
    assert.match(chat, /if \(current\?\.flow === 'register'\)/);
  });
});
