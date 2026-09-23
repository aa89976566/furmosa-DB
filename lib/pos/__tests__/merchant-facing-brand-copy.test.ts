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
  const retiredMerchantCopy = [
    'HQ 已建立出貨單',
    '等待 HQ 審核',
    'HQ 正在審核補貨申請',
    '補貨申請與 HQ 出貨',
    'HQ 更新補貨或出貨狀態',
    'HQ 回覆：',
    'HQ 已核准',
    'HQ 正在安排',
    '商品已離開 HQ',
    '聯絡 HQ',
    'HQ 核准內容',
    'HQ 直接配送',
  ];
  for (const path of merchantFacingFiles) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    for (const copy of retiredMerchantCopy) {
      assert.equal(source.includes(copy), false, `${path} 仍含店家可見文案：${copy}`);
    }
  }
});
