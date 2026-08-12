import { allowsExternalEffects } from '@/lib/external-effects';
import { generateCheckMacValue } from '@/lib/payments/ecpay/check-mac';
import { getEcpayConfig } from '@/lib/payments/ecpay/config';

export type EcpayCheckoutForm = {
  paymentUrl: string;
  fields: Record<string, string>;
};

const EXTERNAL_EFFECTS_DISABLED_ERROR = '外部副作用已停用';

/** Runtime adapter：僅在 choke 讀取兩個政策變數名，傳給純核心。 */
function isEcpayExternalEffectsAllowed(): boolean {
  return allowsExternalEffects({
    APP_ENV: process.env.APP_ENV,
    EXTERNAL_EFFECTS_MODE: process.env.EXTERNAL_EFFECTS_MODE,
  });
}

/** MerchantTradeNo：綠界最長 20，英數 */
export function buildMerchantTradeNo(prefix = 'RF'): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${ts}${rand}`.slice(0, 20);
}

function formatTradeDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function buildEcpayAioCheckout(input: {
  merchantTradeNo: string;
  amount: number;
  itemName: string;
  tradeDesc?: string;
  clientBackUrl?: string;
  customField1?: string;
}): EcpayCheckoutForm {
  // Fail-closed：讀取 merchant config／產生 CheckMac／form／付款 URL 之前先拒絕。
  if (!isEcpayExternalEffectsAllowed()) {
    throw new Error(EXTERNAL_EFFECTS_DISABLED_ERROR);
  }

  const cfg = getEcpayConfig();
  const fields: Record<string, string | number> = {
    MerchantID: cfg.merchantId,
    MerchantTradeNo: input.merchantTradeNo,
    MerchantTradeDate: formatTradeDate(),
    PaymentType: 'aio',
    TotalAmount: input.amount,
    TradeDesc: input.tradeDesc ?? 'FurmosaRefill',
    ItemName: input.itemName.slice(0, 200),
    ReturnURL: cfg.orderResultUrl,
    OrderResultURL: cfg.orderResultUrl,
    ClientBackURL: input.clientBackUrl ?? cfg.returnUrl,
    ChoosePayment: 'ALL',
    EncryptType: 1,
    CustomField1: input.customField1 ?? '',
  };

  const checkMac = generateCheckMacValue(fields, cfg.hashKey, cfg.hashIV);
  const stringFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === '' || v === undefined || v === null) continue;
    stringFields[k] = String(v);
  }
  stringFields.CheckMacValue = checkMac;

  return { paymentUrl: cfg.paymentUrl, fields: stringFields };
}
