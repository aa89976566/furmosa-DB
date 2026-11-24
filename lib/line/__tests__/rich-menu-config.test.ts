import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINE_RICH_MENU_AREAS,
  LINE_RICH_MENU_BODY,
  LINE_RICH_MENU_SIZE,
} from '../rich-menu-config';

describe('LINE rich menu config', () => {
  it('connects the six visible entries to the intended existing flows', () => {
    assert.equal(LINE_RICH_MENU_AREAS.length, 6);
    assert.deepEqual(
      LINE_RICH_MENU_AREAS.map((area) => area.action),
      [
        { type: 'message', text: '線上購物' },
        { type: 'message', text: '換罐計畫' },
        { type: 'message', text: '會員點數' },
        { type: 'message', text: '申請合作' },
        { type: 'message', text: '問問匠寵' },
        { type: 'message', text: '一起野放' },
      ],
    );
    assert.doesNotMatch(JSON.stringify(LINE_RICH_MENU_BODY), /美容/);
  });

  it('keeps every tap area inside the LINE canvas without overlaps', () => {
    for (const [index, area] of LINE_RICH_MENU_AREAS.entries()) {
      const { x, y, width, height } = area.bounds;
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
      assert.ok(x + width <= LINE_RICH_MENU_SIZE.width);
      assert.ok(y + height <= LINE_RICH_MENU_SIZE.height);

      for (const other of LINE_RICH_MENU_AREAS.slice(index + 1)) {
        const a = area.bounds;
        const b = other.bounds;
        const overlap =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        assert.equal(overlap, false);
      }
    }
  });
});
