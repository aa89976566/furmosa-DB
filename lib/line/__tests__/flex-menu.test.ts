import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMainMenuMessages } from '../flex-menu';

describe('buildMainMenuMessages', () => {
  it('returns flex menu with postback buttons', () => {
    const msgs = buildMainMenuMessages({ body: '測試內文', registered: false });
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].type, 'flex');
    if (msgs[0].type === 'flex') {
      const footer = (msgs[0].contents as { footer?: { contents?: unknown[] } }).footer;
      assert.ok(footer?.contents && footer.contents.length >= 3);
    }
  });
});
