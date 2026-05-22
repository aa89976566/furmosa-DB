import type { PrismaClient } from '@prisma/client';
import { CARRIER_711, format711RecipientAddress } from '@/lib/carrier-cvs';

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
    address = null;
  } else if (preferredCarrier === '黑貓') {
    pickupStoreName = null;
    if (!address) {
      return { preferredCarrier, pickupStoreName: null, address: null, error: '請填寫黑貓收件地址' };
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
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  shipping: MerchantShippingFields;
};

/**
 * 建立店家：create 僅含 Prisma 舊版也認得的欄位，其餘聯絡／運輸欄位用 raw SQL 補上。
 */
export async function createMerchantBaseRecord(
  prisma: PrismaClient,
  input: CreateMerchantBaseInput,
) {
  const displayAddress = merchantShippingDisplayAddress(
    input.shipping.preferredCarrier,
    input.shipping.pickupStoreName,
    input.shipping.address,
  );

  const merchant = await prisma.merchant.create({
    data: {
      merchantId: input.merchantId,
      name: input.name,
      type: input.type,
      status: 'active',
    },
  });

  await prisma.$executeRaw`
    UPDATE "Merchant"
    SET
      "contactName" = ${input.contactName},
      "phone" = ${input.phone},
      "email" = ${input.email},
      "city" = ${input.city},
      "notes" = ${input.notes},
      "preferredCarrier" = ${input.shipping.preferredCarrier},
      "pickupStoreName" = ${input.shipping.pickupStoreName},
      "address" = ${input.shipping.address ?? displayAddress}
    WHERE "id" = ${merchant.id}
  `;

  return merchant;
}
