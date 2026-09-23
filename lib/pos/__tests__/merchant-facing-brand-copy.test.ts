import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const merchantFacingFiles = [
  '../../../app/pos/group-buy/page.tsx',
  '../../../app/pos/notifications/page.tsx',
  '../../../app/pos/restock/[id]/page.tsx',
  '../../../app/pos/shipments/[id]/page.tsx',
  '../load-merchant-events.ts',
];

test('店家 POS 對外文案使用匠寵品牌名稱，不顯示內部 HQ 稱呼', () => {
  for (const path of merchantFacingFiles) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /HQ/, `${path} 仍含店家可見的 HQ 文案`);
  }
});
