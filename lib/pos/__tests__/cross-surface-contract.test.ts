import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const saleSource = readFileSync('lib/pos/record-counter-sale.ts', 'utf8');
const progressSource = readFileSync('app/pos/restock/progress/page.tsx', 'utf8');
const receiptSource = readFileSync('app/pos/restock/[id]/actions.ts', 'utf8');

describe('POS 與 HQ 共用資料契約', () => {
  it('現場收銀在同一個 transaction 建立正式訂單並把庫存流水連回訂單', () => {
    assert.match(saleSource, /prisma\.\$transaction/);
    assert.match(saleSource, /tx\.order\.create/);
    assert.match(saleSource, /orderId:\s*order\.id/);
    assert.match(saleSource, /tx\.merchantStock\.updateMany/);
    assert.match(saleSource, /tx\.merchantStockTxn\.create/);
  });

  it('POS 補貨進度包含 HQ 主動建立且未綁申請的出貨單', () => {
    assert.match(progressSource, /type:\s*'merchant_restock'/);
    assert.match(progressSource, /restockRequest:\s*null/);
    assert.match(progressSource, /\/pos\/restock\/shipment\//);
  });

  it('店家驗收 HQ 主動補貨仍以登入店家限制出貨單並在驗收後入庫', () => {
    assert.match(receiptSource, /id:\s*shipmentId, merchantId, type:\s*'merchant_restock'/);
    assert.match(receiptSource, /status:\s*'delivered'/);
    assert.match(receiptSource, /applyMerchantRestockFromShipment/);
  });
});
