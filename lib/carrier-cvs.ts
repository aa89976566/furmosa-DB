/** 表單與出貨單使用的 7-11 物流代碼（與 CarrierSelect 選項一致） */
export const CARRIER_711 = '7-11';

export function is711Carrier(carrier: string | null | undefined): boolean {
  return (carrier ?? '').trim() === CARRIER_711;
}

export function format711RecipientAddress(storeName: string): string {
  return `7-11 · ${storeName.trim()}`;
}

/** 超商取貨：門市名稱與 shippingAddress 同源（避免帶入舊街址） */
export function syncConvenienceShippingAddress(params: {
  cvsBrand: string | null;
  cvsStoreName: string;
  shippingAddress: string | null;
}): string {
  const store = params.cvsStoreName.trim();
  const addr = params.shippingAddress?.trim() || '';
  if (addr && addr.includes(store)) return addr;
  if (params.cvsBrand === '711') return format711RecipientAddress(store);
  if (params.cvsBrand === 'familymart') return `全家 · ${store}`;
  if (params.cvsBrand === 'hilife') return `萊爾富 · ${store}`;
  return `超商 · ${store}`;
}

export type Pickup711Info = {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
};

/** 從進貨／出貨表單讀取 7-11 門市與取件人；非 7-11 時回傳 null */
export function resolve711PickupFromForm(
  formData: FormData,
  carrier: string | null,
): Pickup711Info | null {
  if (!is711Carrier(carrier)) return null;
  const storeName = String(formData.get('pickupStore') ?? '').trim();
  const recipientName = String(formData.get('pickupName') ?? '').trim();
  const recipientPhone = String(formData.get('pickupPhone') ?? '').trim();
  if (!storeName) throw new Error('請填寫 7-11 門市名稱');
  if (!recipientName) throw new Error('請填寫收件人姓名');
  if (!recipientPhone) throw new Error('請填寫收件人電話');
  return {
    recipientName,
    recipientPhone,
    recipientAddress: format711RecipientAddress(storeName),
  };
}

/** 是否已有 7-11 門市與取件人資訊 */
export function has711PickupInfo(shipment: {
  carrier?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
}): boolean {
  if (!is711Carrier(shipment.carrier)) return false;
  const addr = (shipment.recipientAddress ?? '').trim();
  const hasStore = addr.startsWith('7-11') || addr.startsWith('7-ELEVEN');
  return (
    hasStore && !!(shipment.recipientName?.trim() && shipment.recipientPhone?.trim())
  );
}
