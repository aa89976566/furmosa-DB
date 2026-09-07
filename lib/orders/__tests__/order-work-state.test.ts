import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getOrderWorkState, isFulfillmentPaymentReady } from '../order-work-state';

describe('order task state', () => {
  it('never hides NEW or REVIEW behind payment waiting', () => {
    for (const status of ['NEW', 'REVIEW']) {
      for (const paymentStatus of ['unpaid', 'partial', 'paid', 'cod', 'refunded']) {
        assert.equal(getOrderWorkState({ omsStatus: status, paymentStatus }), 'ACTION_REQUIRED');
      }
    }
  });

  it('waits for payment only after review is complete', () => {
    assert.equal(getOrderWorkState({ omsStatus: 'READY', paymentStatus: 'unpaid' }), 'WAITING');
    assert.equal(getOrderWorkState({ omsStatus: 'READY', paymentStatus: 'partial' }), 'WAITING');
    assert.equal(getOrderWorkState({ omsStatus: 'READY', paymentStatus: 'paid' }), 'ACTION_REQUIRED');
    assert.equal(getOrderWorkState({ omsStatus: 'READY', paymentStatus: 'cod' }), 'ACTION_REQUIRED');
  });

  it('keeps refunded or unknown reviewed orders actionable', () => {
    assert.equal(getOrderWorkState({ omsStatus: 'READY', paymentStatus: 'refunded' }), 'ACTION_REQUIRED');
    assert.equal(getOrderWorkState({ omsStatus: 'READY', paymentStatus: 'mystery' }), 'ACTION_REQUIRED');
  });

  it('keeps fulfillment pending actionable and fulfilled done', () => {
    assert.equal(getOrderWorkState({ omsStatus: 'FULFILLMENT_PENDING', paymentStatus: 'paid' }), 'ACTION_REQUIRED');
    assert.equal(getOrderWorkState({ omsStatus: 'FULFILLED', paymentStatus: 'paid' }), 'DONE');
    assert.equal(getOrderWorkState({ omsStatus: null, paymentStatus: 'paid' }), 'DONE');
  });

  it('fails closed for unknown enrolled OMS states', () => {
    assert.equal(getOrderWorkState({ omsStatus: 'UNKNOWN', paymentStatus: 'paid' }), 'ACTION_REQUIRED');
  });

  it('defines fulfillment-ready payment independently from review', () => {
    assert.equal(isFulfillmentPaymentReady('paid'), true);
    assert.equal(isFulfillmentPaymentReady('cod'), true);
    assert.equal(isFulfillmentPaymentReady('unpaid'), false);
    assert.equal(isFulfillmentPaymentReady('partial'), false);
  });
});
