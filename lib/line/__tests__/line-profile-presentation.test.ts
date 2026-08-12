import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINE_DISPLAY_NAME_FALLBACK,
  maskLineUserId,
  resolveLineDisplayName,
} from '../mask-user-id';

/** 模擬 admin 列表單元會渲染的字串，避免引入 React test harness */
function presentLineProfileForAdmin(input: {
  lineUserId: string;
  displayName?: string | null;
  pictureUrl?: string | null;
}) {
  const name = resolveLineDisplayName(input.displayName);
  const maskedId = maskLineUserId(input.lineUserId);
  const hasAvatar = Boolean(input.pictureUrl?.trim());
  return {
    name,
    maskedId,
    hasAvatar,
    fallbackAvatar: !hasAvatar,
    visibleText: `${name}\n${maskedId}`,
  };
}

describe('admin LINE profile presentation', () => {
  const fullId = 'Ueb6e0123456789abcdef0123456789f9fd';

  it('renders name, masked id, and avatar flag when profile available', () => {
    const view = presentLineProfileForAdmin({
      lineUserId: fullId,
      displayName: '開箱小幫手',
      pictureUrl: 'https://profile.line-scdn.net/avatar.png',
    });
    assert.equal(view.name, '開箱小幫手');
    assert.equal(view.maskedId, 'Ueb6e…f9fd');
    assert.equal(view.hasAvatar, true);
    assert.equal(view.fallbackAvatar, false);
    assert.ok(!view.visibleText.includes(fullId));
  });

  it('uses fallback name and neutral avatar when profile missing', () => {
    const view = presentLineProfileForAdmin({
      lineUserId: fullId,
      displayName: null,
      pictureUrl: null,
    });
    assert.equal(view.name, LINE_DISPLAY_NAME_FALLBACK);
    assert.equal(view.maskedId, 'Ueb6e…f9fd');
    assert.equal(view.hasAvatar, false);
    assert.equal(view.fallbackAvatar, true);
    assert.ok(!view.visibleText.includes(fullId));
    assert.ok(!view.visibleText.includes('—\nUeb6e')); // 舊 UI 的「— + 完整 ID」不再出現
  });
});
