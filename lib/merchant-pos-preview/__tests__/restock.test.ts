import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PRODUCTS } from '../fixtures';
import { restockCandidates, stockLevelOf } from '../selectors';
import {
  addAllRestockCandidates,
  addRestockLine,
  createSession,
  removeRestockLine,
  submitRestockDraft,
} from '../session';

function stockSnapshot() {
  return PRODUCTS.flatMap((product) =>
    product.variants.map((variant) => ({ skuId: variant.skuId, availableQty: variant.availableQty })),
  );
}

describe('merchant POS preview restock', () => {
  it('lists only low and sold-out SKUs and stays local', () => {
    const rows = restockCandidates();
    assert.ok(rows.length >= 4);
    for (const row of rows) {
      assert.notEqual(stockLevelOf(row.variant), 'normal');
    }

    const before = stockSnapshot();
    let session = createSession();
    session = addAllRestockCandidates(session);
    assert.ok(session.restockDraft.length > 0);
    session = submitRestockDraft(session);
    assert.match(session.restockNotice ?? '', /預覽/);
    assert.match(session.restockNotice ?? '', /庫存不會增加/);
    assert.equal(session.restockSubmitted, true);
    assert.deepEqual(stockSnapshot(), before);
  });

  it('blocks a second submit', () => {
    let session = createSession();
    session = addRestockLine(session, 'sku-beef-300');
    session = submitRestockDraft(session);
    const again = submitRestockDraft(session);
    assert.match(again.restockNotice ?? '', /已經送出/);
    assert.equal(again.restockDraft.length, session.restockDraft.length);
  });

  it('uses one line per SKU, updates its quantity, and allows removal before submit', () => {
    let session = createSession();
    session = addRestockLine(session, 'sku-beef-150');
    assert.equal(session.restockDraft.length, 1);
    session = {
      ...session,
      restockQtyBySkuId: { ...session.restockQtyBySkuId, 'sku-beef-150': '12' },
    };
    session = addRestockLine(session, 'sku-beef-150');
    assert.deepEqual(session.restockDraft, [{ skuId: 'sku-beef-150', qty: 12 }]);
    session = removeRestockLine(session, 'sku-beef-150');
    assert.deepEqual(session.restockDraft, []);
  });

  it('keeps submitted lines immutable in the preview session', () => {
    let session = createSession();
    session = addRestockLine(session, 'sku-beef-300');
    session = submitRestockDraft(session);
    assert.strictEqual(removeRestockLine(session, 'sku-beef-300'), session);
  });
});
