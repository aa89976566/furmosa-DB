import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cumulativeShare, normalizeReceiptLines } from '../partial-receipt';

test('分批金額保留尾差且合計精確回到原金額', () => {
  for (const total of [1, 101, 99999, 999999999999]) {
    const shares = [1, 2, 3].map((n) => cumulativeShare(total,n,3)-cumulativeShare(total,n-1,3));
    assert.equal(shares.reduce((a,b) => a+b,0),total);
    assert.ok(shares.every(x => x >= 0));
  }
});
test('空白轉零不入庫；負數小數重複行與全空拒絕', () => {
  assert.deepEqual(normalizeReceiptLines([{lineId:'b',quantityGrams:0},{lineId:'a',quantityGrams:400}]),[{lineId:'a',quantityGrams:400}]);
  for (const n of [-1, 0.5, NaN, Infinity]) assert.throws(() => normalizeReceiptLines([{lineId:'a',quantityGrams:n}]));
  assert.throws(() => normalizeReceiptLines([{lineId:'a',quantityGrams:0}]));
  assert.throws(() => normalizeReceiptLines([{lineId:'a',quantityGrams:1},{lineId:'a',quantityGrams:2}]));
  assert.throws(() => cumulativeShare(100,1001,1000));
});
