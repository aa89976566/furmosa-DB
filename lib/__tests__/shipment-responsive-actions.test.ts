import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('出貨工作區介面', () => {
  it('使用精簡工作列，不再顯示大標題與統計卡', () => {
    const page = readFileSync('app/(main)/shipments/page.tsx', 'utf8');
    const body = readFileSync('app/(main)/shipments/shipments-queue-body.tsx', 'utf8');

    assert.doesNotMatch(page, /PageHeader/);
    assert.doesNotMatch(body, /FilterChip/);
    assert.doesNotMatch(body, /xl:grid-cols-4/);
    assert.match(page, /訂單種類：\{activeType\.label\}/);
    assert.match(page, /aria-label="更多出貨工具"/);
  });

  it('出貨階段是主分類，訂單種類不再混入運輸階段', () => {
    const source = readFileSync('app/(main)/shipments/shipments-queue-body.tsx', 'utf8');

    assert.match(source, /const STAGE_TABS =/);
    assert.match(source, /label: '待出貨'/);
    assert.match(source, /label: '運送中'/);
    assert.match(source, /label: '待驗收'/);
    assert.match(source, /label: '已完成'/);
    assert.match(source, /aria-label="出貨階段"/);
    assert.match(source, /bg-black text-white shadow-sm/);
    assert.doesNotMatch(source, /訂閱近期安排/);
  });

  it('桌面表格保留可讀欄寬，電話不逐字換行', () => {
    const source = readFileSync('components/shipments/shipment-queue-table.tsx', 'utf8');

    assert.match(source, /<Table className="min-w-\[62rem\] table-fixed">/);
    assert.match(source, /<span className="whitespace-nowrap">\{logistics\.phone\}<\/span>/);
    assert.doesNotMatch(source, /<span className="break-all">\{logistics\.phone\}<\/span>/);
    assert.match(source, />收件資訊<\/TableHead>/);
    assert.match(source, />商品摘要<\/TableHead>/);
    assert.match(source, />姓名／店家<\/TableHead>/);
    assert.doesNotMatch(source, />電話<\/TableHead>/);
  });

  it('選取提示放在第一個儲存格內，不會讓內容比標題多出一欄', () => {
    const source = readFileSync('components/shipments/shipment-queue-table.tsx', 'utf8');

    assert.doesNotMatch(source, /before:absolute before:inset-y-0 before:left-0/);
    assert.match(source, /after:absolute after:inset-y-0 after:left-0/);
  });

  it('只有目前選取的運輸狀態顯示黑底白字', () => {
    const source = readFileSync(
      'components/shipments/shipment-queue-status-select.tsx',
      'utf8',
    );

    assert.match(source, /border-black bg-black text-white/);
    assert.match(source, /border-transparent bg-transparent text-muted-foreground/);
    assert.doesNotMatch(source, /bg-amber-/);
    assert.doesNotMatch(source, /bg-sky-/);
  });

  it('不同出貨階段共用同一工作區頁籤，不再同時堆疊多張表格', () => {
    const source = readFileSync('components/shipments/shipment-queue-workspace.tsx', 'utf8');

    assert.match(source, /aria-label="出貨階段"/);
    assert.match(source, /const activeSection =/);
    assert.match(source, /shipments=\{activeSection\.shipments\}/);
    assert.doesNotMatch(source, /sections\.map\(\(section\) => \(\s*<SectionBlock/);
  });

  it('取消出貨前需要再次確認', () => {
    const source = readFileSync('components/shipments/shipment-status-actions.tsx', 'utf8');

    assert.match(source, /isDanger\s*&&\s*!window\.confirm/);
    assert.match(source, /確定要取消這張出貨單嗎/);
  });

  it('列表訂單內容只供查看，不重複顯示物流狀態操作', () => {
    const actions = readFileSync(
      'components/shipments/shipment-status-actions.tsx',
      'utf8',
    );
    const panel = readFileSync('components/shipments/shipment-order-panel.tsx', 'utf8');

    assert.match(actions, /const primaryNext =/);
    assert.match(actions, /需要修正狀態？/);
    assert.match(actions, /<details/);
    assert.doesNotMatch(panel, /ShipmentStatusActions/);
    assert.doesNotMatch(panel, />下一步<\/h3>/);
  });

  it('待出貨訂單可直接確認寄出，不再額外要求完成備貨', () => {
    const source = readFileSync('lib/shipment.ts', 'utf8');
    const control = readFileSync(
      'components/shipments/shipment-queue-status-select.tsx',
      'utf8',
    );

    assert.match(source, /case 'pending':\s*return \['shipped', 'cancelled'\]/);
    assert.doesNotMatch(source, /case 'pending':\s*return \['packed'/);
    assert.match(control, /確認已完成交寄/);
    assert.match(control, /role="dialog"/);
    assert.match(control, /createPortal/);
    assert.doesNotMatch(control, /window\.confirm\(`確定已完成交寄/);
    assert.doesNotMatch(
      control.match(/if \(input\.next === 'shipped'\) \{([\s\S]*?)\n  \}/)?.[1] ?? '',
      /params\.set\('s'/,
    );
  });

  it('狀態更新後保留訂單種類，到達後留在待驗收', () => {
    const actions = readFileSync('app/(main)/shipments/actions.ts', 'utf8');
    const panel = readFileSync('components/shipments/shipment-status-actions.tsx', 'utf8');
    const inlineControl = readFileSync(
      'components/shipments/shipment-queue-status-select.tsx',
      'utf8',
    );

    assert.match(panel, /name="queueType" value=\{queueType\}/);
    assert.match(actions, /params\.set\('status', 'delivered'\)/);
    assert.match(actions, /params\.set\('type', queueType\)/);
    assert.match(inlineControl, /name="queueType" value=\{queueType\}/);
    assert.match(inlineControl, /name="inline" value="1"/);
  });

  it('OMS 尚未建立出貨單時顯示審核入口，不顯示舊流程按鈕', () => {
    const source = readFileSync('components/shipments/shipment-queue-table.tsx', 'utf8');

    assert.match(source, /!isOmsShipmentActionable\(omsStatus\)/);
    assert.match(source, /前往訂單審核/);
    assert.match(source, /omsStatus: OmsStatus \| null/);
  });

  it('待出貨卡片統一顯示未寄出與已寄出，未備貨也能直接完成交寄', () => {
    const control = readFileSync(
      'components/shipments/shipment-queue-status-select.tsx',
      'utf8',
    );
    const action = readFileSync('app/(main)/shipments/actions.ts', 'utf8');

    assert.doesNotMatch(control, /label: '完成備貨'/);
    assert.doesNotMatch(control, /label: '已備妥'/);
    assert.match(control, /value: 'pending', label: '未寄出'/);
    assert.match(control, /value: 'packed', label: '未寄出'/);
    assert.equal((control.match(/value: 'shipped', label: '已寄出'/g) ?? []).length >= 2, true);
    assert.match(action, /pending: \['packed', 'shipped', 'cancelled'\]/);
    assert.match(action, /data\.packedAt = shipment\.packedAt \?\? now/);
  });

  it('資料庫交易提交衝突會短暫退避並自動重試', () => {
    const action = readFileSync('app/(main)/shipments/actions.ts', 'utf8');

    assert.match(action, /SHIPMENT_TRANSACTION_MAX_ATTEMPTS = 4/);
    assert.match(action, /SHIPMENT_TRANSACTION_RETRY_BASE_MS \* 2 \*\* attempt/);
    assert.match(action, /transaction failed to commit\|write conflict\|deadlock/);
  });

  it('確認視窗使用自己的原生表單提交，不依賴跨區 form 連結', () => {
    const control = readFileSync(
      'components/shipments/shipment-queue-status-select.tsx',
      'utf8',
    );
    const action = readFileSync('app/(main)/shipments/actions.ts', 'utf8');

    assert.match(control, /import \{ markShipmentStatus \}/);
    assert.equal((control.match(/action=\{markShipmentStatus\}/g) ?? []).length, 2);
    assert.match(control, /name="shipmentId" value=\{shipmentId\}/);
    assert.match(control, /name="next" value="shipped"/);
    assert.match(control, /type="submit"/);
    assert.doesNotMatch(control, /form=\{formId\}/);
    assert.match(control, /pending \? '正在標記…' : '確認已寄出'/);
    assert.doesNotMatch(control, /markShipmentStatusFromQueue\(fd\)/);
    assert.match(action, /params\.set\('error', message\.slice\(0, 120\)\)/);
  });
});
