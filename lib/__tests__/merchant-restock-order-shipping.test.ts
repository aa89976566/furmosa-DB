import assert from 'node:assert/strict';
import test from 'node:test';
import { createRestockOrderWithShipment } from '../merchant-restock-order';

const items = [{ productId: 'p1', quantity: 1, weightGrams: null, unit: null }];
const products = [{ id: 'p1', name: '測試', sku: 'SKU' }];

function restockInput(
  carrier: string | null,
  recipient: {
    recipientName: string | null;
    recipientPhone: string | null;
    recipientAddress: string | null;
  },
  shippingMethod?: string,
) {
  return {
    merchantId: 'm1',
    items,
    products,
    carrier,
    notes: null,
    ...recipient,
    ...(shippingMethod ? { shippingMethod } : {}),
  };
}

test('進貨黑貓／送貨缺欄在寫入前拒絕', async () => {
  await assert.rejects(
    () =>
      createRestockOrderWithShipment(
        restockInput('黑貓', {
          recipientName: '店家',
          recipientPhone: '0911111111',
          recipientAddress: null,
        }),
      ),
    /請填寫收件地址/,
  );
  await assert.rejects(
    () =>
      createRestockOrderWithShipment(
        restockInput('送貨', {
          recipientName: '店家',
          recipientPhone: null,
          recipientAddress: '新北市淡水區測試路 1 號',
        }),
      ),
    /請填寫收件人電話/,
  );
});

test('POS 依 carrier 驗證，不受缺省 shippingMethod 影響', async () => {
  await assert.rejects(
    () =>
      createRestockOrderWithShipment(
        restockInput(
          '黑貓',
          {
            recipientName: '店家',
            recipientPhone: '0911111111',
            recipientAddress: null,
          },
          'delivery',
        ),
      ),
    /請填寫收件地址/,
  );
});
