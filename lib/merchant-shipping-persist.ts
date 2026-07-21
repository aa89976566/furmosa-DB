import type { PrismaClient } from '@prisma/client';
import { CARRIER_711, format711RecipientAddress } from '@/lib/carrier-cvs';
import { SHIPPING_CARRIER_DELIVERY } from '@/lib/shipping-policy';

export type MerchantShippingFields = {
  preferredCarrier: string | null;
  pickupStoreName: string | null;
  address: string | null;
};

function toNullableField(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

export function parseMerchantShippingFromForm(formData: FormData): MerchantShippingFields & {
  error?: string;
} {
  const preferredCarrier = toNullableField(formData.get('preferredCarrier'));
  let pickupStoreName = toNullableField(formData.get('pickupStoreName'));
  let address = toNullableField(formData.get('address'));

  if (preferredCarrier === CARRIER_711) {
    if (!pickupStoreName) {
      return { preferredCarrier, pickupStoreName: null, address: null, error: '請填寫 7-11 門市名稱' };
    }
    // 寫入與門市同源的顯示地址，供出貨／訂單帶入
    address = format711RecipientAddress(pickupStoreName);
  } else if (preferredCarrier === '黑貓') {
    pickupStoreName = null;
    if (!address) {
      return { preferredCarrier, pickupStoreName: null, address: null, error: '請填寫黑貓收件地址' };
    }
  } else if (preferredCarrier === SHIPPING_CARRIER_DELIVERY) {
    pickupStoreName = null;
    if (!address) {
      return { preferredCarrier, pickupStoreName: null, address: null, error: '請填寫送貨地址' };
    }
  }

  return { preferredCarrier, pickupStoreName, address };
}

/** 建立／更新時寫入 `address` 欄的顯示用字串（7-11 用門市格式） */
export function merchantShippingDisplayAddress(
  preferredCarrier: string | null,
  pickupStoreName: string | null,
  address: string | null,
): string | null {
  if (preferredCarrier === CARRIER_711 && pickupStoreName) {
    return format711RecipientAddress(pickupStoreName);
  }
  return address;
}

/**
 * 直接 UPDATE 運輸欄位，避開 Next 打包舊 PrismaClient 時 `Unknown argument preferredCarrier`。
 */
export async function persistMerchantShippingFields(
  prisma: PrismaClient,
  merchantId: string,
  shipping: MerchantShippingFields,
) {
  await prisma.$executeRaw`
    UPDATE "Merchant"
    SET
      "preferredCarrier" = ${shipping.preferredCarrier},
      "pickupStoreName" = ${shipping.pickupStoreName},
      "address" = ${shipping.address}
    WHERE "id" = ${merchantId}
  `;
}

export type CreateMerchantBaseInput = {
  merchantId: string;
  name: string;
  type: string;
  types: string[];
  industry: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  shipping: MerchantShippingFields;
};

/** @deprecated 請改用 insertMerchantRecord（lib/merchant-create.ts） */
export async function createMerchantBaseRecord(
  prisma: PrismaClient,
  input: CreateMerchantBaseInput,
) {
  const { insertMerchantRecord } = await import('@/lib/merchant-create');
  return insertMerchantRecord(prisma, input);
}
