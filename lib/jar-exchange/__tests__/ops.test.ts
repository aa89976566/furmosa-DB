import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JAR_OPS_LOW_STOCK_THRESHOLD,
  JAR_OPS_TARGET_STOCK,
  merchantHasShippingProfile,
  suggestedRestockQty,
  stockCellStatus,
} from '@/lib/jar-exchange/ops';

describe('jar exchange ops stock helpers', () => {
  it('marks negative / out / low / ok', () => {
    assert.equal(stockCellStatus(-1), 'negative');
    assert.equal(stockCellStatus(0), 'out');
    assert.equal(stockCellStatus(JAR_OPS_LOW_STOCK_THRESHOLD), 'low');
    assert.equal(stockCellStatus(JAR_OPS_LOW_STOCK_THRESHOLD + 1), 'ok');
  });

  it('suggests restock including negative stock', () => {
    assert.equal(suggestedRestockQty(-2), JAR_OPS_TARGET_STOCK - -2);
    assert.equal(suggestedRestockQty(0), JAR_OPS_TARGET_STOCK);
    assert.equal(suggestedRestockQty(2), JAR_OPS_TARGET_STOCK - 2);
    assert.equal(suggestedRestockQty(JAR_OPS_LOW_STOCK_THRESHOLD + 1), 0);
  });

  it('requires shipping profile fields', () => {
    assert.equal(
      merchantHasShippingProfile({
        preferredCarrier: '黑貓',
        pickupStoreName: null,
        address: '新北市中和區',
        contactName: '店長',
        phone: '0912345678',
        name: '測試店',
      }),
      true,
    );
    assert.equal(
      merchantHasShippingProfile({
        preferredCarrier: '7-11',
        pickupStoreName: null,
        address: '有地址也沒用',
        contactName: '店長',
        phone: '0912345678',
        name: '測試店',
      }),
      false,
    );
    assert.equal(
      merchantHasShippingProfile({
        preferredCarrier: '7-11',
        pickupStoreName: '某某門市',
        address: null,
        contactName: '店長',
        phone: '0912345678',
        name: '測試店',
      }),
      true,
    );
  });
});
