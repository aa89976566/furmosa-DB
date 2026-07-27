import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prepareReplyMessages } from '../reply';

describe('prepareReplyMessages', () => {
  it('keeps flex in the reply batch when over 5 messages', () => {
    const flex = {
      type: 'flex' as const,
      altText: '選單',
      contents: { type: 'bubble' },
    };
    const messages = [
      {
        type: 'image' as const,
        originalContentUrl: 'https://example.com/a.png',
        previewImageUrl: 'https://example.com/a.png',
      },
      { type: 'text' as const, text: 'a\nb\nc\nd\ne\nf' },
      flex,
    ];
    const { reply, overflow } = prepareReplyMessages(messages, {
      lineUserId: 'U' + 'x'.repeat(32),
    });
    assert.ok(reply.some((m) => m.type === 'flex'), 'flex should stay in reply');
    assert.ok(reply.length <= 5);
    assert.ok(overflow.length > 0);
  });
});
