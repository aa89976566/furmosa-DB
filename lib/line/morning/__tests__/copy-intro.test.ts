import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LINE_REGISTER_INTRO } from '@/lib/line/line-copy';
import { MORNING_STOP_CLARIFY, SUSHI_CRAFTSMAN_INTRO } from '../copy';

describe('sushi craftsman intro copy', () => {
  it('固定開場含單一汪與壽司匠自我介紹', () => {
    const wangCount = (LINE_REGISTER_INTRO.match(/汪/g) ?? []).length;
    assert.equal(wangCount, 1);
    assert.match(LINE_REGISTER_INTRO, /壽司匠/);
    assert.match(LINE_REGISTER_INTRO, /名字或暱稱/);
    assert.match(SUSHI_CRAFTSMAN_INTRO, /確認是自己人了/);
  });

  it('裸停止澄清不關閉交易通知', () => {
    assert.match(MORNING_STOP_CLARIFY, /停止早安|退訂早安/);
    assert.match(MORNING_STOP_CLARIFY, /交易通知/);
  });
});
