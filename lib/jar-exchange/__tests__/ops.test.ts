import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JAR_OPS_LOW_STOCK_THRESHOLD,
  JAR_OPS_TARGET_STOCK,
  suggestedRestockQty,
  stockCellStatus,
} from '@/lib/jar-exchange/ops';

describe('jar exchange ops stock helpers', () => {
  it('marks out / low / ok by threshold', () => {
    assert.equal(stockCellStatus(0), 'out');
    assert.equal(stockCellStatus(JAR_OPS_LOW_STOCK_THRESHOLD), 'low');
    assert.equal(stockCellStatus(JAR_OPS_LOW_STOCK_THRESHOLD + 1), 'ok');
  });

  it('suggests restock only when at or below threshold', () => {
    assert.equal(suggestedRestockQty(0), JAR_OPS_TARGET_STOCK);
    assert.equal(suggestedRestockQty(2), JAR_OPS_TARGET_STOCK - 2);
    assert.equal(
      suggestedRestockQty(JAR_OPS_LOW_STOCK_THRESHOLD),
      JAR_OPS_TARGET_STOCK - JAR_OPS_LOW_STOCK_THRESHOLD,
    );
    assert.equal(suggestedRestockQty(JAR_OPS_LOW_STOCK_THRESHOLD + 1), 0);
    assert.equal(suggestedRestockQty(10), 0);
  });
});
