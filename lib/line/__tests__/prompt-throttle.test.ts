import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildGuestWelcomeText, guestWelcomePromptMarks, lineUnknownText } from '../messages';
import {
  isPromptOnCooldown,
  mergePromptMarks,
  PROMPT_COOLDOWN_MS,
  shouldReplyToUnknownMessage,
} from '../prompt-throttle';

describe('isPromptOnCooldown', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  it('從未提示過 → 可顯示', () => {
    assert.equal(isPromptOnCooldown(null, now), false);
    assert.equal(isPromptOnCooldown(undefined, now), false);
  });

  it('24 小時內已提示 → 冷卻中', () => {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    assert.equal(isPromptOnCooldown(oneHourAgo, now), true);
  });

  it('超過 24 小時 → 可再次提示', () => {
    const justOver = new Date(now.getTime() - (PROMPT_COOLDOWN_MS + 1000));
    assert.equal(isPromptOnCooldown(justOver, now), false);
  });
});

describe('buildGuestWelcomeText', () => {
  it('兩種提示都可顯示時含開戶與存罐文案', () => {
    const text = buildGuestWelcomeText({ showRegister: true, showJar: true });
    assert.match(text, /空罐序號/);
    assert.match(text, /幫毛孩開戶/);
  });

  it('冷卻中省略已提示過的段落', () => {
    const text = buildGuestWelcomeText({ showRegister: false, showJar: false });
    assert.doesNotMatch(text, /空罐序號/);
    assert.doesNotMatch(text, /幫毛孩開戶/);
    assert.match(text, /點下方按鈕/);
  });
});

describe('guestWelcomePromptMarks', () => {
  it('僅在實際顯示時標記', () => {
    assert.deepEqual(guestWelcomePromptMarks({ showRegister: true, showJar: false }), {
      register: true,
      jar: undefined,
    });
  });
});

describe('lineUnknownText', () => {
  it('冷卻中不附存罐提示', () => {
    assert.doesNotMatch(lineUnknownText(false), /8 位序號/);
    assert.match(lineUnknownText(true), /8 位序號/);
  });
});

describe('mergePromptMarks', () => {
  it('合併內文與選單的提示紀錄', () => {
    assert.deepEqual(
      mergePromptMarks({ jar: true }, { register: true }),
      { jar: true, register: true, unknown: false },
    );
  });
});

describe('shouldReplyToUnknownMessage', () => {
  it('無 lineUserId 時允許回覆', async () => {
    assert.equal(await shouldReplyToUnknownMessage(''), true);
  });
});
