import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCheckMacValue, verifyCheckMacValue } from '@/lib/payments/ecpay/check-mac';
import { canTransition } from '@/lib/refill/transitions';
import { REFILL_PRICES, amountsAfterExtraTopup } from '@/lib/refill/constants';
import { parseEcpayFormBody } from '@/lib/refill/callback';

describe('ecpay callback guards (unit)', () => {
  const hashKey = 'testHashKey1234567890';
  const hashIV = 'testHashIV1234567';

  it('7. amount mismatch fails mac or amount check', () => {
    const base = {
      MerchantID: '2000132',
      MerchantTradeNo: 'RFTESTAMT01',
      RtnCode: '1',
      TradeAmt: String(REFILL_PRICES.exchange),
    };
    const mac = generateCheckMacValue(base, hashKey, hashIV);
    assert.equal(
      verifyCheckMacValue({ ...base, CheckMacValue: mac }, hashKey, hashIV),
      true,
    );
    // Tampered amount with old MAC
    assert.equal(
      verifyCheckMacValue(
        { ...base, TradeAmt: '1', CheckMacValue: mac },
        hashKey,
        hashIV,
      ),
      false,
    );
    // Expected server-side: tradeAmt must equal payment.amount (99)
    assert.notEqual(1, REFILL_PRICES.exchange);
  });

  it('18. extra topup amounts fixed at 30 → total 129', () => {
    const a = amountsAfterExtraTopup(99);
    assert.equal(a.extraAmount, 30);
    assert.equal(a.totalAmount, 129);
    assert.equal(canTransition('awaiting_extra_payment', 'paid_waiting_return'), true);
  });

  it('parses form body', () => {
    const p = parseEcpayFormBody('MerchantTradeNo=ABC&RtnCode=1&TradeAmt=99');
    assert.equal(p.MerchantTradeNo, 'ABC');
    assert.equal(p.TradeAmt, '99');
  });
});
