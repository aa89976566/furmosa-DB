import { PrismaClient } from '@prisma/client';
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

/** 變更 Merchant 運輸欄位等 schema 時遞增，開發模式會丟棄快取的 PrismaClient */
const PRISMA_CLIENT_SCHEMA_REV = 4;

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

export const prisma = cacheStale
  ? new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  : g.prisma!;

if (process.env.NODE_ENV !== 'production') {
  g.prisma = prisma;
  g.prismaGeneratedName = generatedName;
  g.prismaSchemaRev = PRISMA_CLIENT_SCHEMA_REV;
}
