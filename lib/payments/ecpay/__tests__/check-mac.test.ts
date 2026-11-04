import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ecpayUrlEncode,
  generateCheckMacValue,
  verifyCheckMacValue,
} from '@/lib/payments/ecpay/check-mac';

describe('ecpay CheckMacValue', () => {
  const hashKey = 'pwFHCqm07zXZTF14N9Sgbtypr5ODFAKE';
  const hashIV = 'EkRm7iFT261dpevs';

  it('generates stable uppercase SHA256 mac', () => {
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'REFILL20260728001',
      MerchantTradeDate: '2026/07/28 12:00:00',
      PaymentType: 'aio',
      TotalAmount: 99,
      TradeDesc: 'FurmosaRefill',
      ItemName: '換罐計畫',
      ReturnURL: 'https://example.com/api/payments/ecpay/callback',
      ChoosePayment: 'ALL',
      EncryptType: 1,
    };
    const mac1 = generateCheckMacValue(params, hashKey, hashIV);
    const mac2 = generateCheckMacValue(params, hashKey, hashIV);
    assert.equal(mac1, mac2);
    assert.match(mac1, /^[A-F0-9]{64}$/);
  });

  it('7. rejects callback when amount mac context differs (tamper)', () => {
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'REFILL20260728001',
      RtnCode: '1',
      TradeAmt: 99,
      CheckMacValue: 'PLACEHOLDER',
    };
    const goodMac = generateCheckMacValue(
      { ...params, CheckMacValue: undefined },
      hashKey,
      hashIV,
    );
    assert.equal(
      verifyCheckMacValue({ ...params, CheckMacValue: goodMac, TradeAmt: 99 }, hashKey, hashIV),
      true,
    );
    // 竄改金額後用舊 MAC → 驗證失敗
    assert.equal(
      verifyCheckMacValue({ ...params, CheckMacValue: goodMac, TradeAmt: 1 }, hashKey, hashIV),
      false,
    );
  });

  it('8. same payload verifies consistently (idempotent mac check)', () => {
    const base = {
      MerchantID: '3002607',
      MerchantTradeNo: 'REFILLDUP001',
      RtnCode: '1',
      TradeAmt: 99,
    };
    const mac = generateCheckMacValue(base, hashKey, hashIV);
    assert.equal(verifyCheckMacValue({ ...base, CheckMacValue: mac }, hashKey, hashIV), true);
    assert.equal(verifyCheckMacValue({ ...base, CheckMacValue: mac }, hashKey, hashIV), true);
  });

  it('includes empty callback fields required by ECPay', () => {
    const callback = {
      MerchantID: '3002607',
      MerchantTradeNo: 'REFILLEMPTY001',
      RtnCode: '1',
      RtnMsg: 'Succeeded',
      TradeAmt: '129',
      CustomField1: '',
      CustomField2: '',
      CustomField3: '',
      CustomField4: '',
      StoreID: '',
    };
    const mac = generateCheckMacValue(callback, hashKey, hashIV);

    assert.equal(
      verifyCheckMacValue({ ...callback, CheckMacValue: mac }, hashKey, hashIV),
      true,
    );
    assert.notEqual(
      mac,
      generateCheckMacValue(
        Object.fromEntries(
          Object.entries(callback).filter(([, value]) => value !== ''),
        ),
        hashKey,
        hashIV,
      ),
    );
  });

  it('uses the ECPay AIO URL encoding rules for special characters', () => {
    assert.equal(
      ecpayUrlEncode(" ~!'*()"),
      "+%7E!%27*()",
    );
  });

  it('sorts parameter names case-insensitively like the official SDK', () => {
    const first = generateCheckMacValue(
      { zebra: '1', Alpha: '2', beta: '3' },
      hashKey,
      hashIV,
    );
    const second = generateCheckMacValue(
      { beta: '3', zebra: '1', Alpha: '2' },
      hashKey,
      hashIV,
    );
    assert.equal(first, second);
  });
});
