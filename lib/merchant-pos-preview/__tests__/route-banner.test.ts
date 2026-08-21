import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  FIXTURE_ONLY_BADGE,
  PREVIEW_BANNER_PRIMARY,
  PREVIEW_BANNER_SECONDARY,
  STORE_NAME,
  TABS,
} from '../copy';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('merchant POS preview route and banner', () => {
  it('exposes /preview/merchant-pos and the six main areas without a more section', () => {
    const page = read('app/preview/merchant-pos/page.tsx');
    const app = read('components/merchant-pos-preview/preview-app.tsx');
    const nav = read('components/merchant-pos-preview/bottom-nav.tsx');
    assert.match(page, /MerchantPosPreviewApp/);
    assert.match(app, /CheckoutPanel/);
    assert.match(app, /SalesPanel/);
    assert.match(app, /RestockPanel/);
    assert.match(app, /PointsRedemptionPanel/);
    assert.match(app, /SettlementPanel/);
    assert.match(nav, /TABS\.checkout/);
    assert.match(nav, /TABS\.sales/);
    assert.match(nav, /TABS\.restock/);
    assert.match(nav, /TABS\.points/);
    assert.match(nav, /TABS\.settlement/);
    assert.equal(TABS.checkout, '收銀');
    assert.equal(TABS.sales, '銷售');
    assert.equal(TABS.refill, '待換罐');
    assert.equal(TABS.restock, '補貨');
    assert.equal(TABS.points, '點數核銷');
    assert.equal(TABS.settlement, '結算');
    assert.equal(nav.includes("id: 'more'"), false);
  });

  it('keeps the fixture-only banner and dummy store name', () => {
    const banner = read('components/merchant-pos-preview/preview-banner.tsx');
    const app = read('components/merchant-pos-preview/preview-app.tsx');
    assert.match(banner, /PREVIEW_BANNER_PRIMARY/);
    assert.match(banner, /PREVIEW_BANNER_SECONDARY/);
    assert.equal(PREVIEW_BANNER_PRIMARY, '操作預覽｜資料不會儲存');
    assert.equal(PREVIEW_BANNER_SECONDARY, '以下為示意商品與訂單，不是正式店家資料');
    assert.match(app, /STORE_NAME/);
    assert.match(app, /FIXTURE_ONLY_BADGE/);
    assert.equal(STORE_NAME, '測試門市');
    assert.equal(FIXTURE_ONLY_BADGE, '示意資料');
  });
});
