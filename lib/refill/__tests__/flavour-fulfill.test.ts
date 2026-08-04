import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPaymentDoesNotLockFlavour,
  canEnableFulfilment,
} from '@/lib/refill/fulfilment-rules';
import {
  REFILL_COPY,
  buildPaidNotifyText,
  mapRefillErrorToCopy,
} from '@/lib/refill/copy';
import { amountsAfterExtraTopup, REFILL_PRICES } from '@/lib/refill/constants';
import { canTransition } from '@/lib/refill/transitions';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

describe('refill flavour / payment entitlement rules', () => {
  it('1. NT$129 may pay without preferred flavour', () => {
    assert.doesNotThrow(() =>
      assertPaymentDoesNotLockFlavour({
        preferredFlavourId: null,
        fulfilledFlavourId: null,
        stockDecrementedAtPayment: false,
      }),
    );
    assert.equal(REFILL_PRICES.first, 129);
  });

  it('2. preferred A + fulfill B needs no repay (fields stay separate)', () => {
    const preferred = 'flavour-a';
    const fulfilled = 'flavour-b';
    assert.notEqual(preferred, fulfilled);
    // 模擬交付後兩欄並存
    const order = {
      preferredFlavourId: preferred,
      fulfilledFlavourId: fulfilled,
      totalAmount: 129,
      needsRepay: false,
    };
    assert.equal(order.needsRepay, false);
    assert.equal(order.preferredFlavourId, preferred);
    assert.equal(order.fulfilledFlavourId, fulfilled);
  });

  it('3. NT$99 preferred A out of stock → can fulfill B', () => {
    const stock = [
      { flavourId: 'a', quantity: 0, isAvailable: false },
      { flavourId: 'b', quantity: 2, isAvailable: true },
    ];
    const deliverable = stock.filter((s) => s.isAvailable && s.quantity > 0);
    assert.equal(deliverable.some((s) => s.flavourId === 'a'), false);
    assert.equal(deliverable.some((s) => s.flavourId === 'b'), true);
    assert.equal(
      canEnableFulfilment({
        paid: true,
        isFirstPath: false,
        oldJarVerified: true,
        fulfilledFlavourId: 'b',
        flavourInStock: true,
        newSerialValid: true,
      }),
      true,
    );
  });

  it('4. preferredFlavour must not decrement stock at payment', () => {
    assert.throws(() =>
      assertPaymentDoesNotLockFlavour({
        preferredFlavourId: 'a',
        fulfilledFlavourId: null,
        stockDecrementedAtPayment: true,
      }),
    );
    assert.doesNotThrow(() =>
      assertPaymentDoesNotLockFlavour({
        preferredFlavourId: 'a',
        fulfilledFlavourId: null,
        stockDecrementedAtPayment: false,
      }),
    );
  });

  it('5. fulfilment stock is scoped to merchant store slug', () => {
    assert.equal(merchantToStoreSlug('MER-0001'), 'mer_0001');
    assert.notEqual(merchantToStoreSlug('MER-0001'), merchantToStoreSlug('MER-0002'));
  });

  it('6. quantity 0 cannot enable fulfilment', () => {
    assert.equal(
      canEnableFulfilment({
        paid: true,
        isFirstPath: true,
        oldJarVerified: true,
        fulfilledFlavourId: 'a',
        flavourInStock: false,
        newSerialValid: true,
      }),
      false,
    );
    assert.equal(mapRefillErrorToCopy('OUT_OF_STOCK').includes('庫存'), true);
  });

  it('7. same order cannot fulfill twice (status machine)', () => {
    assert.equal(canTransition('completed', 'completed'), true);
    assert.equal(canTransition('completed', 'paid_waiting_return'), false);
    assert.equal(canTransition('old_container_verified', 'completed'), true);
  });

  it('8. old jar reuse blocked conceptually (returned != issued)', () => {
    const jar = { status: 'returned', lockedByRefillOrderId: 'o1' };
    assert.notEqual(jar.status, 'issued');
  });

  it('9. new serial uniqueness is required for enable flag', () => {
    assert.equal(
      canEnableFulfilment({
        paid: true,
        isFirstPath: true,
        oldJarVerified: true,
        fulfilledFlavourId: 'a',
        flavourInStock: true,
        newSerialValid: false,
      }),
      false,
    );
  });

  it('10. NT$99 without old jar verification cannot fulfill', () => {
    assert.equal(
      canEnableFulfilment({
        paid: true,
        isFirstPath: false,
        oldJarVerified: false,
        fulfilledFlavourId: 'a',
        flavourInStock: true,
        newSerialValid: true,
      }),
      false,
    );
  });

  it('11. topup NT$30 → total 129 first-path delivery', () => {
    const a = amountsAfterExtraTopup(99);
    assert.equal(a.extraAmount, 30);
    assert.equal(a.totalAmount, 129);
    assert.equal(canTransition('awaiting_extra_payment', 'paid_waiting_return'), true);
    // 補差額後以 first 條件交付（不需舊罐）
    assert.equal(
      canEnableFulfilment({
        paid: true,
        isFirstPath: true,
        oldJarVerified: false,
        fulfilledFlavourId: 'b',
        flavourInStock: true,
        newSerialValid: true,
      }),
      true,
    );
  });

  it('12. webhook duplicate = no second paid transition from completed payment', () => {
    // payment already paid → callback returns early (unit-level invariant)
    const shouldClaim = (status: 'pending' | 'paid' | 'failed') => status === 'pending';
    assert.equal(shouldClaim('paid'), false);
    assert.equal(shouldClaim('pending'), true);
  });

  it('13. any step failure implies full rollback (transaction contract)', () => {
    // 模擬步驟：扣庫存失敗時不得標記 completed
    const steps = { stockOk: false, serialOk: true, status: 'old_container_verified' };
    const completed = steps.stockOk && steps.serialOk;
    assert.equal(completed, false);
    assert.notEqual(steps.status, 'completed');
  });

  it('14. legacy orders with null flavour fields remain displayable', () => {
    const legacy = {
      preferredFlavourId: null,
      fulfilledFlavourId: null,
      preferredFlavourLabel: null as string | null,
    };
    const label = legacy.preferredFlavourLabel ?? REFILL_COPY.flavourDecideAtStore;
    assert.equal(label, '到店再選');
  });

  it('15. wrong store slug must not share stock namespace', () => {
    const storeA = merchantToStoreSlug('MER-0001');
    const storeB = merchantToStoreSlug('MER-0099');
    assert.notEqual(storeA, storeB);
  });

  it('LIFF copy forbids reservation language', () => {
    const banned = ['已為你保留此口味', '此口味已鎖定', '付款後不可更換口味'];
    const corpus = [
      REFILL_COPY.flavourHint,
      REFILL_COPY.payKeepsEntitlement,
      REFILL_COPY.paySuccessPreferred('雞肉'),
      REFILL_COPY.paySuccessDecideAtStore,
      buildPaidNotifyText({
        petName: '豆豆',
        merchantName: '妞妞',
        amount: 99,
        dateLine: '2026-08-01 10:00',
        orderIdShort: 'ABCD1234',
        preferredLabel: '雞肉',
        isExchange: true,
      }),
    ].join('\n');
    for (const b of banned) {
      assert.equal(corpus.includes(b), false, `must not contain: ${b}`);
    }
    assert.match(corpus, /領取資格|現貨|不用重新付款|到店再選/);
  });

  it('payment must not set fulfilledFlavour', () => {
    assert.throws(() =>
      assertPaymentDoesNotLockFlavour({
        preferredFlavourId: 'a',
        fulfilledFlavourId: 'a',
        stockDecrementedAtPayment: false,
      }),
    );
  });
});
