import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINE_DISPLAY_NAME_FALLBACK,
  maskLineUserId,
  resolveLineDisplayName,
} from '../mask-user-id';

describe('maskLineUserId', () => {
  it('masks Messaging API userId as Uxxxx…yyyy', () => {
    const full = 'Ueb6e0123456789abcdef0123456789f9fd';
    assert.equal(maskLineUserId(full), 'Ueb6e…f9fd');
    assert.ok(!maskLineUserId(full).includes(full));
    assert.ok(maskLineUserId(full).length < full.length);
  });

  it('never returns the full raw id for typical LINE ids', () => {
    const full = 'U1234567890abcdef1234567890abcdef';
    const masked = maskLineUserId(full);
    assert.notEqual(masked, full);
    assert.match(masked, /^U1234…cdef$/);
  });

  it('handles empty / short ids safely', () => {
    assert.equal(maskLineUserId(''), '—');
    assert.equal(maskLineUserId('Uab'), 'U…');
  });
});

describe('resolveLineDisplayName', () => {
  it('uses display name when present', () => {
    assert.equal(resolveLineDisplayName('小花'), '小花');
    assert.equal(resolveLineDisplayName('  小花  '), '小花');
  });

  it('falls back when missing', () => {
    assert.equal(resolveLineDisplayName(null), LINE_DISPLAY_NAME_FALLBACK);
    assert.equal(resolveLineDisplayName(undefined), LINE_DISPLAY_NAME_FALLBACK);
    assert.equal(resolveLineDisplayName(''), LINE_DISPLAY_NAME_FALLBACK);
    assert.equal(resolveLineDisplayName('   '), LINE_DISPLAY_NAME_FALLBACK);
  });
});
