import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  dashboardSalesOrderWhere,
  merchantRestockOrderWhere,
  revenueEligibleOrderWhere,
} from '../jar-exchange/revenue';

describe('dashboard revenue filters', () => {
  it('treats consignment restock without customer as merchant restock', () => {
    assert.equal(merchantRestockOrderWhere.source, 'consignment');
    assert.deepEqual(merchantRestockOrderWhere.merchantId, { not: null });
    assert.equal(merchantRestockOrderWhere.customerId, null);
  });

  it('excludes drafts and merchant restocks from revenue', () => {
    assert.deepEqual(revenueEligibleOrderWhere.status, {
      notIn: ['cancelled', 'draft'],
    });
    assert.deepEqual(revenueEligibleOrderWhere.NOT, merchantRestockOrderWhere);
  });

  it('uses the same sales filter for today order counts', () => {
    assert.deepEqual(dashboardSalesOrderWhere, revenueEligibleOrderWhere);
  });
});
