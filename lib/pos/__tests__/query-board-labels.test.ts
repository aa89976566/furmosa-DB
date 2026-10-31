import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const boardSource = readFileSync('components/pos/query-board.tsx', 'utf8');
const navSource = readFileSync('lib/pos/pos-nav.ts', 'utf8');

function mappedLabel(source: string, pattern: RegExp): string | undefined {
  return source.match(pattern)?.[1];
}

describe('POS query board refill display labels', () => {
  it('maps refill to 換罐計畫 on both the tab and the record label', () => {
    const tabLabel = mappedLabel(boardSource, /\{ id: "refill", label: "([^"]+)" \}/);
    const recordLabel = mappedLabel(
      boardSource,
      /const LABELS: Record<QueryKind, string> = \{[^}]*\brefill: "([^"]+)"/,
    );

    assert.equal(tabLabel, '換罐計畫');
    assert.equal(recordLabel, '換罐計畫');
    assert.equal(tabLabel, recordLabel);
    assert.doesNotMatch(boardSource, /id: "refill", label: "美容券"/);
    assert.doesNotMatch(boardSource, /refill: "美容券"/);
  });

  it('keeps the coupon and refill navigation labels', () => {
    const couponLabel = mappedLabel(navSource, /id: 'coupons',[\s\S]*?label: '([^']+)'/);
    const refillNavLabel = mappedLabel(navSource, /id: 'refill',[\s\S]*?label: '([^']+)'/);

    assert.equal(couponLabel, '美容券');
    assert.equal(refillNavLabel, '換罐');
  });
});
