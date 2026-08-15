import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  isEscapeKey,
  nextTabIndex,
} from '../../../components/grooming-voucher-preview/pos-preview-app';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('preview dialog keyboard helper', () => {
  it('cycles Tab forward and Shift+Tab backward', () => {
    assert.equal(nextTabIndex(0, 3, false), 1);
    assert.equal(nextTabIndex(1, 3, false), 2);
    assert.equal(nextTabIndex(2, 3, false), 0);
    assert.equal(nextTabIndex(0, 3, true), 2);
    assert.equal(nextTabIndex(1, 3, true), 0);
    assert.equal(nextTabIndex(-1, 3, false), 0);
    assert.equal(nextTabIndex(-1, 3, true), 2);
    assert.equal(nextTabIndex(0, 0, false), 0);
  });

  it('treats only Escape as the close key', () => {
    assert.equal(isEscapeKey('Escape'), true);
    assert.equal(isEscapeKey('Esc'), false);
    assert.equal(isEscapeKey('Tab'), false);
    assert.equal(isEscapeKey('Enter'), false);
  });
});

describe('preview dialog semantics', () => {
  it('POS review dialog has modal semantics, trap, escape, and inert background', () => {
    const src = read('components/grooming-voucher-preview/pos-preview-app.tsx');
    assert.match(src, /role="dialog"/);
    assert.match(src, /aria-modal="true"/);
    assert.match(src, /aria-labelledby="redeem-review-title"/);
    assert.match(src, /inert:\s*true/);
    assert.match(src, /'aria-hidden':\s*true/);
    assert.match(src, /isEscapeKey\(event\.key\)/);
    assert.match(src, /event\.key !== 'Tab'/);
    assert.match(src, /nextTabIndex\(/);
    assert.match(src, /triggerRef\.current\?\.focus\(\)/);
    assert.match(src, /first\.focus\(\)/);
  });

  it('HQ mobile overlay uses dialog semantics and the same keyboard helper', () => {
    const src = read('components/grooming-voucher-preview/hq-preview-app.tsx');
    assert.match(src, /role=\{isOverlay \? 'dialog' : undefined\}/);
    assert.match(src, /aria-modal=\{isOverlay \? true : undefined\}/);
    assert.match(src, /aria-labelledby=\{isOverlay \? titleId : undefined\}/);
    assert.match(src, /usePreviewDialogFocus\(/);
    assert.match(src, /inert:\s*true/);
    assert.match(src, /'aria-hidden':\s*true/);
  });
});
