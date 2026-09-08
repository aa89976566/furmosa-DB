import { CARRIER_711 } from '@/lib/carrier-cvs';

export type MerchantShippingStatusInput = {
  preferredCarrier: string | null;
  pickupStoreName: string | null;
  address: string | null;
};

export type MerchantShippingIssue = {
  code: 'carrier_missing' | 'cvs_store_missing' | 'address_missing';
  message: string;
  action: string;
};

/** 只描述店家檔案缺什麼，不猜測門市或地址。 */
export function merchantShippingIssue(
  merchant: MerchantShippingStatusInput,
): MerchantShippingIssue | null {
  const carrier = merchant.preferredCarrier?.trim() ?? '';
  if (!carrier) {
    return {
      code: 'carrier_missing',
      message: '尚未設定預設物流。',
      action: '請點「編輯」選擇 7-11、黑貓或送貨，並補上門市或地址。',
    };
  }

  if (carrier === CARRIER_711 && !merchant.pickupStoreName?.trim()) {
    return {
      code: 'cvs_store_missing',
      message: '已選 7-11，但還沒填門市名稱。',
      action: '請點「編輯」補上 7-11 門市，不要用猜測的門市出貨。',
    };
  }

  if ((carrier === '黑貓' || carrier === '送貨') && !merchant.address?.trim()) {
    return {
      code: 'address_missing',
      message: carrier === '送貨' ? '已選送貨，但還沒填送貨地址。' : '已選黑貓，但還沒填收件地址。',
      action: '請點「編輯」補上地址，不要用猜測的地址出貨。',
    };
  }

  return null;
}
