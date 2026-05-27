import { Prisma, type PrismaClient } from '@prisma/client';
import { isMerchantType, type MerchantType } from '@/lib/merchant-types';

function isMissingTypesColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /types/i.test(msg) && /(does not exist|Unknown column|42703)/i.test(msg);
}

export async function getMerchantTypes(
  prisma: PrismaClient,
  merchantId: string,
  fallbackType: string,
): Promise<MerchantType[]> {
  try {
    const rows = await prisma.$queryRaw<{ types: string[] | null; type: string }[]>`
      SELECT "types", "type" FROM "Merchant" WHERE "id" = ${merchantId} LIMIT 1
    `;
    const row = rows[0];
    if (!row) return isMerchantType(fallbackType) ? [fallbackType] : ['consignment'];
    if (row.types?.length) {
      const valid = row.types.filter(isMerchantType);
      if (valid.length) return valid;
    }
    return isMerchantType(row.type) ? [row.type] : ['consignment'];
  } catch (e) {
    if (isMissingTypesColumnError(e)) {
      return isMerchantType(fallbackType) ? [fallbackType] : ['consignment'];
    }
    throw e;
  }
}

export async function persistMerchantTypes(
  prisma: PrismaClient,
  merchantId: string,
  types: MerchantType[],
) {
  const primary = types[0] ?? 'consignment';
  await prisma.$executeRaw`
    UPDATE "Merchant"
    SET
      "types" = ${types}::text[],
      "type" = ${primary}
    WHERE "id" = ${merchantId}
  `;
}

export async function getMerchantTypesMap(
  prisma: PrismaClient,
  merchants: { id: string; type: string }[],
): Promise<Map<string, MerchantType[]>> {
  if (merchants.length === 0) return new Map();
  const ids = merchants.map((m) => m.id);
  try {
    const rows = await prisma.$queryRaw<{ id: string; types: string[] | null; type: string }[]>`
      SELECT "id", "types", "type" FROM "Merchant" WHERE "id" IN (${Prisma.join(ids)})
    `;
    return new Map(
      rows.map((r) => {
        if (r.types?.length) {
          const valid = r.types.filter(isMerchantType);
          if (valid.length) return [r.id, valid] as const;
        }
        const single = isMerchantType(r.type) ? [r.type] : (['consignment'] as MerchantType[]);
        return [r.id, single] as const;
      }),
    );
  } catch (e) {
    if (isMissingTypesColumnError(e)) {
      return new Map(
        merchants.map((m) => [
          m.id,
          isMerchantType(m.type) ? [m.type] : (['consignment'] as MerchantType[]),
        ]),
      );
    }
    throw e;
  }
}
