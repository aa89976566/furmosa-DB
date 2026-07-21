import { CARRIER_711, format711RecipientAddress, is711Carrier } from '@/lib/carrier-cvs';
import { SHIPPING_CARRIER_DELIVERY } from '@/lib/shipping-policy';

export type MerchantShippingDefaults = {
  pickupStore: string;
  pickupName: string;
  pickupPhone: string;
  defaultCarrier: string;
};

export type MerchantProfile = {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  preferredCarrier?: string | null;
  pickupStoreName?: string | null;
};

/** 從出貨單地址還原 7-11 門市名稱（格式：7-11 · 門市名） */
export function parse711StoreFromAddress(address: string | null | undefined): string | null {
  const a = (address ?? '').trim();
  const match = a.match(/^7-11\s*[·•]\s*(.+)$/i);
  return match?.[1]?.trim() || null;
}

export type MerchantOrderShippingFields = {
  recipientName: string;
  recipientPhone: string;
  shippingMethod: 'home' | 'convenience' | 'delivery';
  cvsBrand: string;
  cvsStoreName: string;
  shippingAddress: string;
};

/** 新增訂單：依店家檔案帶入「出貨與收件」 */
export function merchantShippingToOrderFields(
  merchant: MerchantProfile,
): MerchantOrderShippingFields {
  const d = profileDefaults(merchant);
  const carrier = d.defaultCarrier;
  const recipientName = d.pickupName;
  const recipientPhone = d.pickupPhone;

  if (carrier === SHIPPING_CARRIER_DELIVERY) {
    const deliveryAddr =
      merchant.address?.trim() ||
      [merchant.city?.trim(), merchant.name.trim()].filter(Boolean).join(' ') ||
      d.pickupStore;

    return {
      recipientName,
      recipientPhone,
      shippingMethod: 'delivery',
      cvsBrand: '711',
      cvsStoreName: '',
      shippingAddress: deliveryAddr,
    };
  }

  if (is711Carrier(carrier)) {
    const storeName =
      merchant.pickupStoreName?.trim() ||
      parse711StoreFromAddress(merchant.address) ||
      d.pickupStore.replace(/^7-11\s*[·•]\s*/i, '').trim() ||
      d.pickupStore;
    // 與門市名稱同源，避免帶入舊的宅配／送貨街址造成兩邊不一致
    const shippingAddress = storeName ? format711RecipientAddress(storeName) : '';

    return {
      recipientName,
      recipientPhone,
      shippingMethod: 'convenience',
      cvsBrand: '711',
      cvsStoreName: storeName,
      shippingAddress,
    };
  }

  const homeAddr =
    merchant.address?.trim() ||
    [merchant.city?.trim(), merchant.name.trim()].filter(Boolean).join(' ') ||
    d.pickupStore;

  return {
    recipientName,
    recipientPhone,
    shippingMethod: 'home',
    cvsBrand: '711',
    cvsStoreName: '',
    shippingAddress: homeAddr,
  };
}

function inferCarrierFromLegacy(address: string | null | undefined): string {
  const a = (address ?? '').toLowerCase();
  if (
    a.includes('7-11') ||
    a.includes('711') ||
    a.includes('seven') ||
    a.includes('超商')
  ) {
    return CARRIER_711;
  }
  return '';
}

export function profileDefaults(merchant: MerchantProfile): MerchantShippingDefaults {
  const pickupName = merchant.contactName?.trim() || merchant.name.trim();
  const pickupPhone = merchant.phone?.trim() || '';
  const carrier =
    merchant.preferredCarrier?.trim() ||
    inferCarrierFromLegacy(merchant.address) ||
    CARRIER_711;

  let pickupStore = '';
  if (carrier === CARRIER_711) {
    pickupStore =
      merchant.pickupStoreName?.trim() ||
      parse711StoreFromAddress(merchant.address) ||
      // 舊資料可能把街址寫在 address；711 時不以街址充當門市名
      '';
    if (!pickupStore) {
      pickupStore = [merchant.city?.trim(), merchant.name.trim()]
        .filter(Boolean)
        .join(' · ');
    }
  } else {
    pickupStore =
      merchant.address?.trim() ||
      [merchant.city?.trim(), merchant.name.trim()].filter(Boolean).join(' · ');
  }

  return { pickupStore, pickupName, pickupPhone, defaultCarrier: carrier };
}

/** 依店家檔案與最近一次進貨出貨單，產生進貨表單預設物流資訊 */
export function resolveMerchantShippingDefaults(
  merchant: MerchantProfile,
  lastRestockShipment?: {
    carrier: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    recipientAddress: string | null;
  } | null,
): MerchantShippingDefaults {
  const fromProfile = profileDefaults(merchant);

  if (!merchant.preferredCarrier?.trim() && lastRestockShipment?.carrier) {
    const carrier = lastRestockShipment.carrier.trim();
    if (carrier === CARRIER_711) {
      const store =
        parse711StoreFromAddress(lastRestockShipment.recipientAddress) ||
        fromProfile.pickupStore;
      return {
        pickupStore: store,
        pickupName:
          lastRestockShipment.recipientName?.trim() || fromProfile.pickupName,
        pickupPhone:
          lastRestockShipment.recipientPhone?.trim() || fromProfile.pickupPhone,
        defaultCarrier: CARRIER_711,
      };
    }
    return { ...fromProfile, defaultCarrier: carrier };
  }

  return fromProfile;
}

export function merchantCarrierLabel(carrier: string | null | undefined): string {
  const c = (carrier ?? '').trim();
  if (c === CARRIER_711) return '7-11';
  if (c === '黑貓') return '黑貓';
  if (c === '送貨') return '送貨';
  return '未設定';
}
