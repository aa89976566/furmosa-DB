function readEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export function getEcpayConfig(): {
  merchantId: string;
  hashKey: string;
  hashIV: string;
  paymentUrl: string;
  returnUrl: string;
  orderResultUrl: string;
} {
  const merchantId = readEnv('ECPAY_MERCHANT_ID');
  const hashKey = readEnv('ECPAY_HASH_KEY');
  const hashIV = readEnv('ECPAY_HASH_IV');
  if (!merchantId || !hashKey || !hashIV) {
    throw new Error('缺少綠界環境變數 ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV');
  }

  const appUrl = (readEnv('NEXT_PUBLIC_APP_URL') ?? '').replace(/\/$/, '');
  const paymentUrl =
    readEnv('ECPAY_PAYMENT_URL') ??
    'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
  const returnUrl =
    readEnv('ECPAY_RETURN_URL') ?? `${appUrl}/api/payments/ecpay/return`;
  const orderResultUrl =
    readEnv('ECPAY_ORDER_RESULT_URL') ??
    `${appUrl}/api/payments/ecpay/callback`;

  if (!appUrl && (!readEnv('ECPAY_RETURN_URL') || !readEnv('ECPAY_ORDER_RESULT_URL'))) {
    throw new Error('請設定 NEXT_PUBLIC_APP_URL 或完整的 ECPAY_RETURN_URL／ECPAY_ORDER_RESULT_URL');
  }

  return { merchantId, hashKey, hashIV, paymentUrl, returnUrl, orderResultUrl };
}

export function isEcpayConfigured(): boolean {
  return Boolean(
    readEnv('ECPAY_MERCHANT_ID') &&
      readEnv('ECPAY_HASH_KEY') &&
      readEnv('ECPAY_HASH_IV'),
  );
}
