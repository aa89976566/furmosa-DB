import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  createIdentityDecision,
  listIdentityDecisions,
} from '@/lib/jar-exchange/partner-store-identity-store';
import {
  isPreviewIdentityEnv,
  shouldInsertBootstrapDecision,
  type PartnerStoreIdentityVerdict,
} from '@/lib/jar-exchange/partner-store-identity-decisions';

/**
 * Preview 才允許寫入的初始確認。
 * 這不是清單資料來源；清單只讀資料庫有效列。
 * 已有歷史（含已撤銷）的組合不會再自動插入。
 */
const PREVIEW_BOOTSTRAP: Array<{
  merchantId: string;
  legacySlug: string | null;
  verdict: PartnerStoreIdentityVerdict;
  rationale: string;
}> = [
  {
    merchantId: 'MER-0019',
    legacySlug: 'zhuwo_banqiao',
    verdict: 'same_store',
    rationale: '總部人工判斷：豬窩板橋門市。舊核銷 zhuwo_banqiao 與 MER-0019 為同一家；與土城、中和分開。',
  },
  {
    merchantId: 'MER-0020',
    legacySlug: 'zhuwo_tucheng',
    verdict: 'same_store',
    rationale: '總部人工判斷：豬窩土城門市。舊核銷 zhuwo_tucheng 與 MER-0020 為同一家；與板橋、中和分開。',
  },
  {
    merchantId: 'MER-0016',
    legacySlug: 'zhuwo_zhonghe',
    verdict: 'same_store',
    rationale: '總部人工判斷：豬窩中和門市。舊核銷 zhuwo_zhonghe 與 MER-0016 為同一家；與板橋、土城分開。',
  },
  {
    merchantId: 'MER-0017',
    legacySlug: 'manlisa',
    verdict: 'same_store',
    rationale: '總部人工判斷：曼利莎寵物美容。舊核銷 manlisa 與 MER-0017 為同一家。',
  },
  {
    merchantId: 'MER-0010',
    legacySlug: 'niuniu',
    verdict: 'same_store',
    rationale: '總部人工判斷：淡水妞妞。舊核銷 niuniu 與 MER-0010 為同一家。',
  },
  {
    merchantId: 'MER-OTHER',
    legacySlug: 'mer_other',
    verdict: 'test',
    rationale: '總部人工判斷：錯誤店家對照，系統／測試資料。不刪除。',
  },
  {
    merchantId: 'MER-REFILL',
    legacySlug: 'mer_refill',
    verdict: 'test',
    rationale:
      '總部人工判斷：匠寵換罐測試店。不刪除。測試換罐 #RFP-260729-12Z5 不計正式合作門市與營運 KPI。',
  },
  {
    merchantId: 'MER-DEMO',
    legacySlug: null,
    verdict: 'demo',
    rationale: '總部人工判斷：Furmosa Preview 示範店。不刪除、不新增核銷 slug。',
  },
];

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "partner_store_identity_decisions" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "legacy_slug" TEXT,
    "verdict" TEXT NOT NULL,
    "decided_by_user_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL,
    "rationale" TEXT NOT NULL,
    "other_record_disposition" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'production',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" TEXT,
    "revoke_reason" TEXT,
    CONSTRAINT "partner_store_identity_decisions_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "partner_store_identity_decisions_scope_revoked_at_idx"
    ON "partner_store_identity_decisions"("scope", "revoked_at")`,
  `CREATE INDEX IF NOT EXISTS "partner_store_identity_decisions_merchant_id_scope_idx"
    ON "partner_store_identity_decisions"("merchant_id", "scope")`,
  `CREATE INDEX IF NOT EXISTS "partner_store_identity_decisions_legacy_slug_scope_idx"
    ON "partner_store_identity_decisions"("legacy_slug", "scope")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "partner_store_identity_decisions_active_merchant_scope"
    ON "partner_store_identity_decisions"("merchant_id", "scope")
    WHERE "revoked_at" IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "partner_store_identity_decisions_active_slug_scope"
    ON "partner_store_identity_decisions"("legacy_slug", "scope")
    WHERE "revoked_at" IS NULL AND "legacy_slug" IS NOT NULL`,
];

const FK_STATEMENTS = [
  `DO $$ BEGIN
  ALTER TABLE "partner_store_identity_decisions"
    ADD CONSTRAINT "partner_store_identity_decisions_decided_by_user_id_fkey"
    FOREIGN KEY ("decided_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "partner_store_identity_decisions"
    ADD CONSTRAINT "partner_store_identity_decisions_revoked_by_user_id_fkey"
    FOREIGN KEY ("revoked_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
];

function isSoftDdlError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /duplicate_/i.test(msg) ||
    /already exists/i.test(msg) ||
    /prepared statement/i.test(msg) ||
    /cannot insert multiple commands/i.test(msg)
  );
}

async function withDdlClient<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const direct = process.env.DIRECT_URL?.trim();
  const pooled = process.env.DATABASE_URL?.trim();
  if (direct && pooled && direct !== pooled) {
    const db = new PrismaClient({
      datasources: { db: { url: direct } },
      log: ['error'],
    });
    try {
      return await fn(db);
    } finally {
      await db.$disconnect().catch(() => undefined);
    }
  }
  return fn(prisma);
}

let schemaReady: Promise<void> | null = null;

async function runEnsurePreviewTable() {
  if (!isPreviewIdentityEnv()) return;
  await withDdlClient(async (db) => {
    for (const sql of DDL_STATEMENTS) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch (error) {
        if (!isSoftDdlError(error)) throw error;
      }
    }
    for (const sql of FK_STATEMENTS) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch (error) {
        if (!isSoftDdlError(error)) {
          console.warn('[partner-store-identity] preview FK skipped', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  });
}

export async function ensurePreviewIdentityTable(): Promise<void> {
  if (!isPreviewIdentityEnv()) return;
  if (!schemaReady) {
    schemaReady = runEnsurePreviewTable().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export async function seedPreviewIdentityDecisions(actor: {
  userId: string;
  email: string;
}): Promise<number> {
  if (!isPreviewIdentityEnv()) return 0;
  await ensurePreviewIdentityTable();
  const existing = await listIdentityDecisions('preview');
  let inserted = 0;
  const decidedAt = new Date();
  for (const item of PREVIEW_BOOTSTRAP) {
    if (
      !shouldInsertBootstrapDecision(existing, {
        merchantId: item.merchantId,
        legacySlug: item.legacySlug,
        scope: 'preview',
      })
    ) {
      continue;
    }
    const result = await createIdentityDecision({
      merchantId: item.merchantId,
      legacySlug: item.legacySlug,
      verdict: item.verdict,
      decidedByUserId: actor.userId,
      decidedByAccount: actor.email,
      decidedAt,
      rationale: item.rationale,
      otherRecordDisposition: 'keep_legacy_link',
      scope: 'preview',
    });
    if (result.ok) {
      existing.push(result.decision);
      inserted += 1;
    }
  }
  return inserted;
}
