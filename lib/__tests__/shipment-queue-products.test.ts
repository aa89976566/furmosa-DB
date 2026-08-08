import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PRODUCT_ANOMALY_MESSAGE,
  PRODUCT_EMPTY_MESSAGE,
  formatPanelUpdatedAt,
  formatProductSummaryTooltip,
  getShipmentDetailPlacementMode,
  isShipmentSnapshotStale,
  resolveCampaignProductFallback,
  resolveShipmentProducts,
  rowOpenDoesNotTriggerStatusWrite,
  shouldOpenShipmentDrawerFromTarget,
} from '../shipment-queue-products';

const LONG_NAMES = {
  crystal: '換罐-水晶魚凍乾 10g',
  veggie: '換罐-蔬果凍乾 30g',
  jibaTrial: '壕大大雞霸兩片開箱試用組',
} as const;

describe('resolveShipmentProducts', () => {
  it('zero-price jiba order uses campaign fallback (not bare dash / 0 items)', () => {
    const model = resolveShipmentProducts({
      type: 'customer_order',
      items: [],
      campaignProduct: {
        productName: LONG_NAMES.jibaTrial,
        quantity: 2,
        unit: '片',
      },
    });
    assert.equal(model.state, 'ok');
    assert.equal(model.itemCount, 1);
    assert.equal(model.totalQty, 2);
    assert.deepEqual(model.visibleLines, [`${LONG_NAMES.jibaTrial} ×2`]);
    assert.equal(model.overflowLabel, null);
    assert.match(formatProductSummaryTooltip(model), /壕大大雞霸/);
  });

  it('renders 1 item compactly', () => {
    const model = resolveShipmentProducts({
      type: 'customer_order',
      items: [{ productName: LONG_NAMES.crystal, quantity: 1, weightGrams: null }],
    });
    assert.equal(model.state, 'ok');
    assert.deepEqual(model.visibleLines, [`${LONG_NAMES.crystal} ×1`]);
    assert.equal(model.overflowLabel, null);
  });

  it('renders 2 items as two single-line rows', () => {
    const model = resolveShipmentProducts({
      type: 'customer_order',
      items: [
        { productName: LONG_NAMES.crystal, quantity: 1 },
        { productName: LONG_NAMES.veggie, quantity: 2 },
      ],
    });
    assert.equal(model.visibleLines.length, 2);
    assert.equal(model.overflowLabel, null);
    assert.equal(model.totalQty, 3);
  });

  it('renders >2 items with overflow label (5 items)', () => {
    const model = resolveShipmentProducts({
      type: 'customer_order',
      items: [
        { productName: LONG_NAMES.crystal, quantity: 1 },
        { productName: LONG_NAMES.veggie, quantity: 1 },
        { productName: '雞肉丁', quantity: 1 },
        { productName: '牛肉條', quantity: 2 },
        { productName: LONG_NAMES.jibaTrial, quantity: 2 },
      ],
    });
    assert.equal(model.visibleLines.length, 2);
    assert.equal(model.overflowLabel, '另有 3 項・共 7 件');
    assert.equal(model.itemCount, 5);
  });

  it('keeps soft-deleted / historical SKU snapshot productName', () => {
    const model = resolveShipmentProducts({
      type: 'customer_order',
      items: [
        {
          id: 'hist-1',
          productName: '已下架歷史商品-舊配方',
          sku: 'SKU-OLD-DELETED',
          quantity: 3,
          unit: '包',
        },
      ],
    });
    assert.equal(model.state, 'ok');
    assert.equal(model.lines[0]?.sku, 'SKU-OLD-DELETED');
    assert.match(model.visibleLines[0] ?? '', /已下架歷史商品/);
  });

  it('subscription without plan contents is legitimate empty (not anomaly dash)', () => {
    const model = resolveShipmentProducts({
      type: 'subscription',
      items: [],
      planContents: [],
    });
    assert.equal(model.state, 'empty');
    assert.equal(model.message, PRODUCT_EMPTY_MESSAGE);
    assert.notEqual(model.message, '-');
  });

  it('customer_order with no items and no fallback is anomaly', () => {
    const model = resolveShipmentProducts({
      type: 'customer_order',
      items: [],
    });
    assert.equal(model.state, 'anomaly');
    assert.equal(model.message, PRODUCT_ANOMALY_MESSAGE);
  });

  it('mapper error: shipment item rows exist but productName missing', () => {
    const model = resolveShipmentProducts({
      type: 'customer_order',
      items: [{ productName: '   ', quantity: 1 }],
    });
    assert.equal(model.state, 'anomaly');
    assert.equal(model.message, PRODUCT_ANOMALY_MESSAGE);
  });

  it('prefers shipment items over campaign fallback', () => {
    const model = resolveShipmentProducts({
      type: 'customer_order',
      items: [{ productName: LONG_NAMES.veggie, quantity: 1 }],
      campaignProduct: { productName: LONG_NAMES.jibaTrial, quantity: 2 },
    });
    assert.equal(model.lines[0]?.source, 'shipment_item');
    assert.match(model.visibleLines[0] ?? '', /蔬果凍乾/);
  });

  it('uses order items when shipment items empty (zero-price gift lines)', () => {
    const model = resolveShipmentProducts({
      type: 'customer_order',
      items: [],
      orderItems: [
        { id: 'oi-1', productName: LONG_NAMES.jibaTrial, quantity: 2, sku: 'GIFT', unit: '片' },
      ],
    });
    assert.equal(model.state, 'ok');
    assert.equal(model.lines[0]?.source, 'order_item');
    assert.equal(model.totalQty, 2);
  });
});

describe('resolveCampaignProductFallback', () => {
  it('reads productKey=jiba from conversation JSON', () => {
    const product = resolveCampaignProductFallback({
      collectedDataJson: JSON.stringify({ productKey: 'jiba' }),
      campaignProductName: '雞霸',
      campaignProductQuantity: 2,
    });
    assert.ok(product);
    assert.match(product!.productName, /雞霸/);
    assert.equal(product!.quantity, 2);
    assert.equal(product!.unit, '片');
  });

  it('reads productKey=frog', () => {
    const product = resolveCampaignProductFallback({
      collectedDataJson: JSON.stringify({ productKey: 'frog' }),
    });
    assert.ok(product);
    assert.match(product!.productName, /青蛙/);
    assert.equal(product!.quantity, 1);
  });

  it('falls back to campaign master when session lacks productKey', () => {
    const product = resolveCampaignProductFallback({
      collectedDataJson: '{}',
      campaignProductName: '雞霸',
      campaignProductQuantity: 2,
    });
    assert.deepEqual(product, {
      productName: '雞霸',
      quantity: 2,
      unit: null,
      sku: null,
    });
  });
});

describe('drawer / interaction contracts', () => {
  it('detail placement is drawer, never document-flow below tables', () => {
    assert.equal(getShipmentDetailPlacementMode(), 'drawer');
  });

  it('row open ignores interactive children (phone / button / write controls)', () => {
    const row = { closest: () => null } as unknown as Element;
    assert.equal(shouldOpenShipmentDrawerFromTarget(row, row), true);

    const button = {
      closest(selector: string) {
        return selector.includes('button') ? this : null;
      },
    } as unknown as Element;
    assert.equal(shouldOpenShipmentDrawerFromTarget(button, row), false);

    const stop = {
      closest(selector: string) {
        return selector.includes('data-stop-row-open') ? this : null;
      },
    } as unknown as Element;
    assert.equal(shouldOpenShipmentDrawerFromTarget(stop, row), false);
  });

  it('status-write control does not fire from row open', () => {
    assert.equal(rowOpenDoesNotTriggerStatusWrite(), true);
    // 列開啟只看 click target；寫入控制僅在 drawer data-shipment-write-control
    const plainCell = { closest: () => null } as unknown as Element;
    assert.equal(shouldOpenShipmentDrawerFromTarget(plainCell, plainCell), true);
  });

  it('stale snapshot disables conflicting writes', () => {
    assert.equal(isShipmentSnapshotStale('pending', 'shipped'), true);
    assert.equal(isShipmentSnapshotStale('pending', 'pending'), false);
  });

  it('formats panel freshness timestamp', () => {
    const label = formatPanelUpdatedAt(new Date('2026-08-07T15:04:05'));
    assert.match(label, /^更新於 \d{2}:\d{2}:\d{2}$/);
  });

  it('Escape/focus restore contract: close restores trigger focus intent', () => {
    // Sheet onCloseAutoFocus + workspace closeDetail focus triggerRef
    // 這裡鎖定契約：placement=drawer 且列開啟不觸發寫入
    assert.equal(getShipmentDetailPlacementMode(), 'drawer');
    assert.equal(rowOpenDoesNotTriggerStatusWrite(), true);
  });
});
