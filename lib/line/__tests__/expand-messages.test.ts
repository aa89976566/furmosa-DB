import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expandLineMessages } from '../expand-messages';
import type { LineReplyMessage } from '../reply';

describe('expandLineMessages', () => {
  it('splits text on newlines into separate bubbles', () => {
    const out = expandLineMessages([
      {
        type: 'text',
        text: '好，工作來了。\n\n我們先把雞霸送到你指定的 7-11。\n一次問一題，不用一次交代人生。',
      },
      { type: 'text', text: '第一題。\n收件人姓名是？' },
    ]);
    assert.deepEqual(out, [
      { type: 'text', text: '好，工作來了。' },
      { type: 'text', text: '我們先把雞霸送到你指定的 7-11。' },
      { type: 'text', text: '一次問一題，不用一次交代人生。' },
      { type: 'text', text: '第一題。' },
      { type: 'text', text: '收件人姓名是？' },
    ]);
  });

  it('keeps quickReply on the last bubble of that text', () => {
    const out = expandLineMessages([
      {
        type: 'text',
        text: '第一行\n第二行',
        quickReply: {
          items: [{ type: 'action', action: { type: 'message', label: '好', text: '好' } }],
        },
      },
    ]);
    assert.equal(out.length, 2);
    assert.deepEqual(out[0], { type: 'text', text: '第一行' });
    const last = out[1] as Extract<LineReplyMessage, { type: 'text' }>;
    assert.equal(last.text, '第二行');
    assert.equal(last.quickReply?.items.length, 1);
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
