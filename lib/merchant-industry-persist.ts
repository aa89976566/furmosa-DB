import { Prisma, type PrismaClient } from '@prisma/client';

function isMissingIndustryColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /industry/i.test(msg) && /(does not exist|Unknown column|42703)/i.test(msg);
}

/** 以 raw SQL 讀取產業，避免舊版 Prisma Client 不認得 Merchant.industry */
export async function getMerchantIndustry(
  prisma: PrismaClient,
  merchantId: string,
): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ industry: string | null }[]>`
      SELECT "industry" FROM "Merchant" WHERE "id" = ${merchantId} LIMIT 1
    `;
    return rows[0]?.industry ?? null;
  } catch (e) {
    if (isMissingIndustryColumnError(e)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[merchant-industry] 資料庫尚無 industry 欄位，請執行 npx prisma migrate deploy',
        );
      }
      return null;
    }
    throw e;
  }
}

export async function getMerchantIndustryMap(
  prisma: PrismaClient,
  merchantIds: string[],
): Promise<Map<string, string | null>> {
  if (merchantIds.length === 0) return new Map();
  try {
    const rows = await prisma.$queryRaw<{ id: string; industry: string | null }[]>`
      SELECT "id", "industry" FROM "Merchant" WHERE "id" IN (${Prisma.join(merchantIds)})
    `;
    return new Map(rows.map((r) => [r.id, r.industry]));
  } catch (e) {
    if (isMissingIndustryColumnError(e)) return new Map();
    throw e;
  }
}
