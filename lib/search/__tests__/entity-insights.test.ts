import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * 純邏輯測：常買排序（數量優先、訂單次數次之）
 * DB 整合測留待有 DATABASE_URL 的環境。
 */
function rankTopProducts(
  rows: Array<{ productId: string; productName: string; quantity: number; orderCount: number }>,
) {
  return [...rows]
    .sort((a, b) => b.quantity - a.quantity || b.orderCount - a.orderCount)
    .slice(0, 3);
}

describe('entity search insight ranking', () => {
  it('ranks by quantity then order frequency', () => {
    const ranked = rankTopProducts([
      { productId: 'a', productName: 'A', quantity: 5, orderCount: 5 },
      { productId: 'b', productName: 'B', quantity: 10, orderCount: 2 },
      { productId: 'c', productName: 'C', quantity: 10, orderCount: 4 },
      { productId: 'd', productName: 'D', quantity: 1, orderCount: 1 },
    ]);
    assert.deepEqual(
      ranked.map((r) => r.productId),
      ['c', 'b', 'a'],
    );
  });
});
