import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { restockStatusLabelForMerchant } from '@/lib/restock-request/constants';

describe('POS restock progress stays aligned with HQ review status', () => {
  it('maps every HQ restock status the merchant progress page already shows', () => {
    const merchantByHq: Record<string, string> = {
      submitted: '公司確認中',
      under_review: '公司確認中',
      approved: '已確認',
      rejected: '需要調整',
      converted_to_shipment: '備貨中',
      cancelled: '已取消',
    };
    for (const [status, label] of Object.entries(merchantByHq)) {
      assert.equal(restockStatusLabelForMerchant(status), label);
    }
  });
});
