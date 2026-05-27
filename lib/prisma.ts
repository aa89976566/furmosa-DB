import { Prisma, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * `prisma generate` 後 `.prisma/client/package.json` 的 `name` 會變（內含 schema hash）。
 * 開發時若仍快取舊的 `PrismaClient`，會出現 Unknown field — 用此 id 偵測並重建實例。
 */
function getPrismaGeneratedPackageName(): string {
  try {
    const p = join(process.cwd(), 'node_modules', '.prisma', 'client', 'package.json');
    if (!existsSync(p)) return '';
    const pkg = JSON.parse(readFileSync(p, 'utf8')) as { name?: string };
    return pkg.name ?? '';
  } catch {
    return '';
  }
}

/** 變更 schema 時遞增，開發模式會丟棄快取的 PrismaClient（含 companyShippingCost） */
const PRISMA_CLIENT_SCHEMA_REV = 14;

const PRISMA_STALE_MSG =
  'Prisma Client 過期：請先關閉所有終端機的 npm run dev（含 localhost:3000/3001/3002），再執行 npx prisma migrate deploy && npx prisma generate && npm run dev';

function assertPrismaSchemaFields() {
  const orderFields = Prisma.OrderScalarFieldEnum;
  const missing: string[] = [];
  if (!('companyShippingCost' in orderFields)) missing.push('Order.companyShippingCost');
  if (!('giftCost' in orderFields)) missing.push('Order.giftCost');
  if (!('JarCode' in Prisma.ModelName)) missing.push('JarCode');
  if (!('MemberPointsLedger' in Prisma.ModelName)) missing.push('MemberPointsLedger');
  if (missing.length > 0) {
    throw new Error(`${PRISMA_STALE_MSG}\n缺少：${missing.join(', ')}`);
  }
  // industry 以 raw SQL 讀取（lib/merchant-industry-persist.ts），不在此強制檢查 Client 欄位
}

type GlobalPrisma = {
  prisma?: PrismaClient;
  prismaGeneratedName?: string;
  prismaSchemaRev?: number;
};

const g = globalThis as unknown as GlobalPrisma;

const generatedName = getPrismaGeneratedPackageName();

const cacheStale =
  !g.prisma ||
  g.prismaGeneratedName !== generatedName ||
  g.prismaSchemaRev !== PRISMA_CLIENT_SCHEMA_REV;

if (g.prisma && cacheStale) {
  void g.prisma.$disconnect();
  g.prisma = undefined;
}

const prismaClient = cacheStale
  ? new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  : g.prisma!;

if (process.env.NODE_ENV === 'development') {
  assertPrismaSchemaFields();
}

export const prisma = prismaClient;

if (process.env.NODE_ENV !== 'production') {
  g.prisma = prisma;
  g.prismaGeneratedName = generatedName;
  g.prismaSchemaRev = PRISMA_CLIENT_SCHEMA_REV;
}
