import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOMER_OPEN_REFILL_STATUSES,
  filterIssuedJarsForCustomer,
  isOpenRefillStatus,
  refillOrderStatusLabel,
} from '@/lib/customers/customer-crm-labels';
import { ledgerSourceLabel } from '@/lib/jar-exchange/labels';
import { REFILL_ACTIVE_STATUSES } from '@/lib/refill/constants';

describe('customer CRM sprint1 helpers', () => {
  it('ledger label includes refill_completed', () => {
    assert.equal(ledgerSourceLabel.refill_completed, '換罐交付完成');
  });

  it('open refill statuses match REFILL_ACTIVE and exclude completed/cancelled', () => {
    assert.deepEqual([...CUSTOMER_OPEN_REFILL_STATUSES], [...REFILL_ACTIVE_STATUSES]);
    assert.equal(isOpenRefillStatus('payment_pending'), true);
    assert.equal(isOpenRefillStatus('paid_waiting_return'), true);
    assert.equal(isOpenRefillStatus('old_container_verified'), true);
    assert.equal(isOpenRefillStatus('awaiting_extra_payment'), true);
    assert.equal(isOpenRefillStatus('completed'), false);
    assert.equal(isOpenRefillStatus('cancelled'), false);
  });

  it('refill status labels cover HQ quick-scan wording', () => {
    assert.equal(refillOrderStatusLabel('payment_pending'), '待付款');
    assert.equal(refillOrderStatusLabel('awaiting_extra_payment'), '待補款 NT$30');
    assert.equal(refillOrderStatusLabel('paid_waiting_return'), '已付款 待驗舊罐');
    assert.equal(refillOrderStatusLabel('old_container_verified'), '舊罐已驗收 待交付');
  });

  it('filterIssuedJarsForCustomer keeps only issued jars for that customer', () => {
    const rows = [
      { status: 'issued', redeemedByCustomerId: 'c1', code: '11111111' },
      { status: 'returned', redeemedByCustomerId: 'c1', code: '22222222' },
      { status: 'issued', redeemedByCustomerId: 'c2', code: '33333333' },
      { status: 'used', redeemedByCustomerId: 'c1', code: '44444444' },
      { status: 'issued', redeemedByCustomerId: null, code: '55555555' },
    ];
    const filtered = filterIssuedJarsForCustomer(rows, 'c1');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.code, '11111111');
  });

  it('ledger link path uses Prisma cuid when present', () => {
    const customer = { id: 'cuid_abc', name: '吳小姐', customerId: 'furmosa-0154' };
    const href = customer.id ? `/customers/${customer.id}` : null;
    assert.equal(href, '/customers/cuid_abc');
    assert.notEqual(href, `/customers/${customer.customerId}`);
  });

  it('no customer id yields no link', () => {
    const customerWithoutId = { name: '匿名' } as { id?: string; name: string };
    const href = customerWithoutId.id
      ? `/customers/${customerWithoutId.id}`
      : null;
    assert.equal(href, null);

    function ledgerCustomerHref(
      customer: { id?: string } | null | undefined,
    ): string | null {
      return customer?.id ? `/customers/${customer.id}` : null;
    }

    assert.equal(ledgerCustomerHref(null), null);
    assert.equal(ledgerCustomerHref(undefined), null);
    assert.equal(ledgerCustomerHref({ name: '匿名' } as { id?: string }), null);
  });
});
