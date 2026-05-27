import type { PrismaClient } from '@prisma/client';
import {
  merchantShippingDisplayAddress,
  type CreateMerchantBaseInput,
  type MerchantShippingFields,
} from '@/lib/merchant-shipping-persist';

/** Prisma cuid 風格 id（不依賴 @prisma/client 的 create） */
function newMerchantRowId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 11);
  return `c${t}${r}`.slice(0, 25);
}

/**
 * 以 raw SQL 建立店家，完全避開 prisma.merchant.create（舊 Client 不認得 types）。
 */
export async function insertMerchantRecord(
  prisma: PrismaClient,
  input: CreateMerchantBaseInput,
): Promise<{ id: string; merchantId: string; name: string; type: string }> {
  const displayAddress = merchantShippingDisplayAddress(
    input.shipping.preferredCarrier,
    input.shipping.pickupStoreName,
    input.shipping.address,
  );
  const id = newMerchantRowId();
  const address = input.shipping.address ?? displayAddress;

  try {
    const rows = await prisma.$queryRaw<
      { id: string; merchantId: string; name: string; type: string }[]
    >`
      INSERT INTO "Merchant" (
        "id",
        "merchantId",
        "name",
        "type",
        "types",
        "status",
        "industry",
        "contactName",
        "phone",
        "email",
        "city",
        "notes",
        "preferredCarrier",
        "pickupStoreName",
        "address",
        "commissionRate",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${id},
        ${input.merchantId},
        ${input.name},
        ${input.type},
        ${input.types}::text[],
        'active',
        ${input.industry},
        ${input.contactName},
        ${input.phone},
        ${input.email},
        ${input.city},
        ${input.notes},
        ${input.shipping.preferredCarrier},
        ${input.shipping.pickupStoreName},
        ${address},
        0.30,
        NOW(),
        NOW()
      )
      RETURNING "id", "merchantId", "name", "type"
    `;
    const row = rows[0];
    if (!row) throw new Error('建立店家失敗');
    return row;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/types/i.test(msg) || !/(does not exist|42703)/i.test(msg)) throw e;

    const rows = await prisma.$queryRaw<
      { id: string; merchantId: string; name: string; type: string }[]
    >`
      INSERT INTO "Merchant" (
        "id",
        "merchantId",
        "name",
        "type",
        "status",
        "industry",
        "contactName",
        "phone",
        "email",
        "city",
        "notes",
        "preferredCarrier",
        "pickupStoreName",
        "address",
        "commissionRate",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${id},
        ${input.merchantId},
        ${input.name},
        ${input.type},
        'active',
        ${input.industry},
        ${input.contactName},
        ${input.phone},
        ${input.email},
        ${input.city},
        ${input.notes},
        ${input.shipping.preferredCarrier},
        ${input.shipping.pickupStoreName},
        ${address},
        0.30,
        NOW(),
        NOW()
      )
      RETURNING "id", "merchantId", "name", "type"
    `;
    const row = rows[0];
    if (!row) throw new Error('建立店家失敗');
    return row;
  }
}

export type { CreateMerchantBaseInput, MerchantShippingFields };
