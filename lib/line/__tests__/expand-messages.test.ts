import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expandLineMessages } from '../expand-messages';
import type { LineReplyMessage } from '../reply';

describe('expandLineMessages', () => {
  it('splits text on newlines into separate bubbles', () => {
    const out = expandLineMessages([
      {
        type: 'text',
        text: '好喔，那我們開始幫毛孩安排雞霸～\n\n會先寄到你指定的 7-11。\n一次問一小題就好，不急，慢慢填。',
      },
      { type: 'text', text: '先從第一題開始喔。\n收件人姓名是？' },
    ]);
    assert.deepEqual(out, [
      { type: 'text', text: '好喔，那我們開始幫毛孩安排雞霸～' },
      { type: 'text', text: '會先寄到你指定的 7-11。' },
      { type: 'text', text: '一次問一小題就好，不急，慢慢填。' },
      { type: 'text', text: '先從第一題開始喔。' },
      { type: 'text', text: '收件人姓名是？' },
    ]);
  });

  it('keeps quickReply message unsplit (按鈕跟文案同一則)', () => {
    const qr = {
      items: [{ type: 'action', action: { type: 'message', label: '我同意', text: '我同意' } }],
    };
    const out = expandLineMessages([
      {
        type: 'text',
        text: '投稿前，可以請你按下面按鈕同意授權嗎？\n\n參加活動代表你同意……',
        quickReply: qr,
      },
    ]);
    assert.equal(out.length, 1);
    const only = out[0] as Extract<LineReplyMessage, { type: 'text' }>;
    assert.match(only.text, /投稿前/);
    assert.match(only.text, /參加活動代表你同意/);
    assert.equal(only.quickReply?.items.length, 1);
  });

  it('leaves flex/image untouched', () => {
    const flex: LineReplyMessage = {
      type: 'flex',
      altText: 'x',
      contents: { type: 'bubble' },
    };
    const out = expandLineMessages([flex, { type: 'text', text: '只有一行' }]);
    assert.deepEqual(out, [flex, { type: 'text', text: '只有一行' }]);
  });
});
