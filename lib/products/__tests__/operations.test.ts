import assert from 'node:assert/strict';
import test from 'node:test';
import { productMainStock, formatUnitCost } from '../operations';

test('main balance keeps negative stock and explicit units', () => {
  const stock = productMainStock({quantity:-150,unit:'g'},'克');
  assert.equal(stock.negative,true);
  assert.equal(stock.verified,true);
  assert.equal(stock.label,'-150 g');
});
test('missing and mismatched inventory never appears verified or as zero stock', () => {
  assert.equal(productMainStock(undefined,'g').label,'尚無紀錄');
  assert.equal(productMainStock({quantity:10,unit:null},'g').verified,false);
  assert.equal(productMainStock({quantity:10,unit:'隻'},'g').verified,false);
});
test('per gram purchasing cost retains precision below one cent', () => {
  assert.match(formatUnitCost('0.003125'), /0\.003125/);
});
