import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyMerchantRestockFromShipment,
  validateRestockReceiptShipment,
} from '@/lib/merchant-restock-inventory';

type FakeOptions = {
  postedItemIds?: Array<string | null>;
  legacyNotes?: Array<string | null>;
  existingProductIds?: string[];
};

function fakeTransaction(options: FakeOptions = {}) {
  const stockWrites: Array<Record<string, unknown>> = [];
  const txnWrites: Array<Record<string, unknown>> = [];
  const postedItemIds = options.postedItemIds ?? [];
  const existingProductIds = options.existingProductIds ?? ['product-1', 'product-2'];

  const tx = {
    merchantStockTxn: {
      findMany: async ({
        where,
      }: {
        where?: { shipmentItemId?: unknown; note?: unknown };
      }) => {
        if (where?.shipmentItemId) {
          return postedItemIds.map((shipmentItemId) => ({ shipmentItemId }));
        }
        if (where?.note) {
          return (options.legacyNotes ?? []).map((note) => ({ note }));
        }
        return [];
      },
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        txnWrites.push(data);
        return data;
      },
    },
    product: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in
          .filter((id) => existingProductIds.includes(id))
          .map((id) => ({ id, priceTiers: [] })),
    },
    merchantStock: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        stockWrites.push(create);
        return { ...create, quantity: create.quantity };
      },
    },
  };

  return { tx: tx as never, stockWrites, txnWrites };
}

const shipment = {
  shipmentNumber: 'SHP-TEST-0001',
  merchantId: 'merchant-1',
  items: [
    { id: 'item-1', productId: 'product-1', quantity: 2, weightGrams: null },
    { id: 'item-2', productId: 'product-2', quantity: 3, weightGrams: null },
  ],
};

describe('店家補貨確認收貨入庫', () => {
  it('只允許同店家的補貨出貨單從 delivered 確認收貨', () => {
    assert.equal(
      validateRestockReceiptShipment(
        { merchantId: 'merchant-1', type: 'merchant_restock', status: 'delivered' },
        'merchant-1',
      ),
      'ready',
    );
    assert.equal(
      validateRestockReceiptShipment(
        { merchantId: 'merchant-1', type: 'merchant_restock', status: 'received' },
        'merchant-1',
      ),
      'already_received',
    );
    assert.throws(
      () =>
        validateRestockReceiptShipment(
          { merchantId: 'merchant-2', type: 'merchant_restock', status: 'delivered' },
          'merchant-1',
        ),
      /找不到/,
    );
    assert.throws(
      () =>
        validateRestockReceiptShipment(
          { merchantId: 'merchant-1', type: 'customer_order', status: 'delivered' },
          'merchant-1',
        ),
      /不是店家補貨/,
    );
    assert.throws(
      () =>
        validateRestockReceiptShipment(
          { merchantId: 'merchant-1', type: 'merchant_restock', status: 'shipped' },
          'merchant-1',
        ),
      /尚未送達/,
    );
  });

  it('每個出貨品項只建立一筆可追溯的入庫流水', async () => {
    const { tx, stockWrites, txnWrites } = fakeTransaction();

    const posted = await applyMerchantRestockFromShipment(tx, shipment, new Date('2026-09-04'));

    assert.equal(posted, true);
    assert.equal(stockWrites.length, 2);
    assert.deepEqual(
      txnWrites.map((row) => row.shipmentItemId),
      ['item-1', 'item-2'],
    );
    assert.deepEqual(
      txnWrites.map((row) => row.quantity),
      [2, 3],
    );
    assert.deepEqual(
      txnWrites.map((row) => row.note),
      ['來自出貨單 SHP-TEST-0001', '來自出貨單 SHP-TEST-0001'],
    );
  });

  it('全部品項已入庫時安全略過，不重複增加庫存', async () => {
    const { tx, stockWrites, txnWrites } = fakeTransaction({
      postedItemIds: ['item-1', 'item-2'],
    });

    const posted = await applyMerchantRestockFromShipment(tx, shipment, new Date());

    assert.equal(posted, false);
    assert.equal(stockWrites.length, 0);
    assert.equal(txnWrites.length, 0);
  });

  it('只有部分品項已入庫時拒絕繼續，避免補一半', async () => {
    const { tx, stockWrites } = fakeTransaction({ postedItemIds: ['item-1'] });

    await assert.rejects(
      () => applyMerchantRestockFromShipment(tx, shipment, new Date()),
      /入庫紀錄不完整/,
    );
    assert.equal(stockWrites.length, 0);
  });

  it('精準舊格式備註視為已入庫，安全略過', async () => {
    const { tx, stockWrites, txnWrites } = fakeTransaction({
      legacyNotes: ['來自出貨單 SHP-TEST-0001'],
    });

    const posted = await applyMerchantRestockFromShipment(tx, shipment, new Date());

    assert.equal(posted, false);
    assert.equal(stockWrites.length, 0);
    assert.equal(txnWrites.length, 0);
  });

  it('舊格式前後空白仍可辨識為已入庫', async () => {
    const { tx, stockWrites, txnWrites } = fakeTransaction({
      legacyNotes: ['  來自出貨單 SHP-TEST-0001  '],
    });

    const posted = await applyMerchantRestockFromShipment(tx, shipment, new Date());

    assert.equal(posted, false);
    assert.equal(stockWrites.length, 0);
    assert.equal(txnWrites.length, 0);
  });

  it('SHP-123 不得把 SHP-1234 的舊備註誤當成已入庫', async () => {
    const shortShipment = {
      shipmentNumber: 'SHP-123',
      merchantId: 'merchant-1',
      items: [{ id: 'item-1', productId: 'product-1', quantity: 2, weightGrams: null }],
    };
    const { tx, stockWrites, txnWrites } = fakeTransaction({
      legacyNotes: ['來自出貨單 SHP-1234'],
      existingProductIds: ['product-1'],
    });

    const posted = await applyMerchantRestockFromShipment(tx, shortShipment, new Date());

    assert.equal(posted, true);
    assert.equal(stockWrites.length, 1);
    assert.equal(txnWrites.length, 1);
    assert.equal(txnWrites[0].shipmentItemId, 'item-1');
    assert.equal(txnWrites[0].note, '來自出貨單 SHP-123');
  });

  it('含出貨單語意但格式無法明確認定時 fail closed', async () => {
    const { tx, stockWrites, txnWrites } = fakeTransaction({
      legacyNotes: ['[來源] 出貨紀錄（備註：SHP-TEST-0001）'],
    });

    await assert.rejects(
      () => applyMerchantRestockFromShipment(tx, shipment, new Date()),
      /人工檢查/,
    );
    assert.equal(stockWrites.length, 0);
    assert.equal(txnWrites.length, 0);
  });

  it('空品項、無效數量或不存在商品都拒絕入庫', async () => {
    const empty = fakeTransaction();
    await assert.rejects(
      () => applyMerchantRestockFromShipment(empty.tx, { ...shipment, items: [] }, new Date()),
      /沒有品項/,
    );

    const invalidQuantity = fakeTransaction();
    await assert.rejects(
      () =>
        applyMerchantRestockFromShipment(
          invalidQuantity.tx,
          { ...shipment, items: [{ ...shipment.items[0], quantity: 0 }] },
          new Date(),
        ),
      /品項資料不完整/,
    );

    const missingProduct = fakeTransaction({ existingProductIds: [] });
    await assert.rejects(
      () => applyMerchantRestockFromShipment(missingProduct.tx, shipment, new Date()),
      /不存在的商品/,
    );
    assert.equal(missingProduct.stockWrites.length, 0);
  });
});
