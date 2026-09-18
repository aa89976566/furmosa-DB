import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('出貨工作區介面', () => {
  it('桌面表格保留可讀欄寬，電話不逐字換行', () => {
    const source = readFileSync('components/shipments/shipment-queue-table.tsx', 'utf8');

    assert.match(source, /<Table className="min-w-\[64rem\] table-fixed">/);
    assert.match(source, /<span className="whitespace-nowrap">\{logistics\.phone\}<\/span>/);
    assert.doesNotMatch(source, /<span className="break-all">\{logistics\.phone\}<\/span>/);
  });

  it('取消出貨前需要再次確認', () => {
    const source = readFileSync('components/shipments/shipment-status-actions.tsx', 'utf8');

    assert.match(source, /isDanger\s*&&\s*!window\.confirm/);
    assert.match(source, /確定要取消這張出貨單嗎/);
  });

  it('OMS 尚未建立出貨單時顯示審核入口，不顯示舊流程按鈕', () => {
    const source = readFileSync('components/shipments/shipment-queue-table.tsx', 'utf8');

    assert.match(source, /!isOmsShipmentActionable\(omsStatus\)/);
    assert.match(source, /前往訂單審核/);
    assert.match(source, /omsStatus: OmsStatus \| null/);
  });
});
