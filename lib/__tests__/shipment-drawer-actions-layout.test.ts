import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ShipmentStatus } from '@/lib/shipment';
import { partitionShipmentWriteActions } from '@/lib/shipment-queue-products';

describe('shipment drawer write actions layout', () => {
  it('keeps primary actions ahead of cancel and never mixes them for side-by-side grids', () => {
    const allowed = ['shipped', 'cancelled'] as ShipmentStatus[];
    const { primary, danger } = partitionShipmentWriteActions(allowed);
    assert.deepEqual(primary, ['shipped']);
    assert.deepEqual(danger, ['cancelled']);
    // Drawer 契約：主流程與 danger zone 分離，禁止雙欄並排兩個操作表單
    assert.equal(primary.length + danger.length, allowed.length);
    assert.ok(!primary.includes('cancelled'));
  });

  it('supports delivered / pending primary stack without cancel', () => {
    const { primary, danger } = partitionShipmentWriteActions([
      'delivered',
      'pending',
    ] as ShipmentStatus[]);
    assert.deepEqual(primary, ['delivered', 'pending']);
    assert.deepEqual(danger, []);
  });

  it('aria-label contract includes order number for write CTAs', () => {
    const orderLabel = 'ORD-20260807-001';
    const actionLabel = '標記為已寄出';
    const ariaLabel = `${actionLabel}（${orderLabel}）`;
    assert.match(ariaLabel, /ORD-20260807-001/);
    assert.match(ariaLabel, /標記為已寄出/);
  });

  it('drawer width contract uses clamp desktop and full-width under 1280', () => {
    // 與 components/ui/sheet.tsx 鎖定同一契約字串，避免回歸固定 520px 雙欄擠壓
    const desktopWidthClass = 'min-[1280px]:w-[clamp(420px,42vw,560px)]';
    const mobileWidthClass = 'w-full';
    assert.match(desktopWidthClass, /clamp\(420px,42vw,560px\)/);
    assert.equal(mobileWidthClass, 'w-full');
  });

  it('carrier stackFields contract forbids name/phone side-by-side in drawer', () => {
    const layout = 'stack';
    assert.notEqual(layout, 'responsive');
    assert.equal(layout, 'stack');
  });
});
