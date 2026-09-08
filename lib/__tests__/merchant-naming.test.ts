import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { merchantTypeLabel } from '../merchant-types';

describe('店家總稱與寄賣類型標籤', () => {
  it('類型與分潤仍使用寄賣，不改商業模式名稱', () => {
    assert.equal(merchantTypeLabel.consignment, '寄賣');
  });

  it('店家管理頁標題用店家，訂單來源仍標示寄賣', () => {
    const layout = readFileSync(
      new URL('../../app/(main)/merchants/(hub)/layout.tsx', import.meta.url),
      'utf8',
    );
    assert.match(layout, />店家</);
    assert.match(layout, /訂單來源一律為「寄賣」/);
    assert.doesNotMatch(layout, /<h1[^>]*>寄賣</);
  });

  it('編號異常只對損壞編號提供手動修復，測試號不誤判', () => {
    const page = readFileSync(
      new URL('../../app/(main)/merchants/[id]/page.tsx', import.meta.url),
      'utf8',
    );
    assert.match(page, /businessIdKind === 'invalid'/);
    assert.match(page, /businessIdKind === 'reserved'/);
    assert.match(page, /按下修復才會改成/);
    assert.doesNotMatch(page, /repairMerchantBusinessId\(\)/);

    const actions = readFileSync(
      new URL('../../app/(main)/merchants/[id]/actions.ts', import.meta.url),
      'utf8',
    );
    assert.match(actions, /測試或示範編號不可改成正式店家編號/);
    assert.match(actions, /canRepairMerchantBusinessId/);
  });
});
