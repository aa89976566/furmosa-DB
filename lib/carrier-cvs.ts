/** 表單與出貨單使用的 7-11 物流代碼（與 CarrierSelect 選項一致） */
export const CARRIER_711 = '7-11';

export function is711Carrier(carrier: string | null | undefined): boolean {
  return (carrier ?? '').trim() === CARRIER_711;
}

export function format711RecipientAddress(storeName: string): string {
  return `7-11 · ${storeName.trim()}`;
}

export type Pickup711Info = {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
};

/** 從表單讀取 7-11 取件資訊；非 7-11 或缺欄位時回傳 null（不丟錯） */
export function tryResolve711PickupFromForm(
  formData: FormData,
  carrier: string | null,
): Pickup711Info | null {
  if (!is711Carrier(carrier)) return null;
  const storeName = String(formData.get('pickupStore') ?? '').trim();
  const recipientName = String(formData.get('pickupName') ?? '').trim();
  const recipientPhone = String(formData.get('pickupPhone') ?? '').trim();
  if (!storeName || !recipientName || !recipientPhone) return null;
  return {
    recipientName,
    recipientPhone,
    recipientAddress: format711RecipientAddress(storeName),
  };
}

/** 從進貨／出貨表單讀取 7-11 門市與取件人；非 7-11 時回傳 null；缺欄位時丟錯 */
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

function looksLikeCvsStoreAddress(address: string | null | undefined): boolean {
  const addr = (address ?? '').trim();
  if (!addr) return false;
  return (
    addr.startsWith('7-11') ||
    addr.startsWith('7-ELEVEN') ||
    addr.includes('門市') ||
    addr.includes('全家') ||
    addr.includes('萊爾富')
  );
}

/**
 * 超商取貨是否已足以標記寄出。
 * 訂單有品牌＋門市名即可；或出貨單上已有完整 7-11／門市收件資料。
 * 「所在區域」(shippingAddress) 為加分項，缺了不應擋住寄出。
 */
export function hasConveniencePickupReady(input: {
  order?: {
    shippingMethod?: string | null;
    cvsBrand?: string | null;
    cvsStoreName?: string | null;
    shippingAddress?: string | null;
  } | null;
  shipment?: {
    carrier?: string | null;
    recipientName?: string | null;
    recipientPhone?: string | null;
    recipientAddress?: string | null;
  } | null;
}): boolean {
  const order = input.order;
  if (!order || order.shippingMethod !== 'convenience') return true;

  if (order.cvsBrand?.trim() && order.cvsStoreName?.trim()) return true;

  const shipment = input.shipment;
  if (!shipment) return false;
  if (has711PickupInfo(shipment)) return true;

  const hasContact =
    Boolean(shipment.recipientName?.trim()) && Boolean(shipment.recipientPhone?.trim());
  if (!hasContact) return false;

  if (order.cvsStoreName?.trim()) return true;
  if (looksLikeCvsStoreAddress(shipment.recipientAddress)) return true;
  if (looksLikeCvsStoreAddress(order.shippingAddress)) return true;

  return false;
}
