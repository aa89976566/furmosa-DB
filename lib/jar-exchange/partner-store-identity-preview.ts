import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  createIdentityDecision,
  listIdentityDecisions,
} from '@/lib/jar-exchange/partner-store-identity-store';
import { PREVIEW_ACCEPTANCE_ROWS } from '@/lib/jar-exchange/partner-store-identity-acceptance-rows';
import { canWritePreviewIdentityData } from '@/lib/jar-exchange/partner-store-identity-isolation';
import { shouldInsertBootstrapDecision } from '@/lib/jar-exchange/partner-store-identity-decisions';

const PREVIEW_BOOTSTRAP = PREVIEW_ACCEPTANCE_ROWS;

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
  if (!canWritePreviewIdentityData()) return;
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
  if (!canWritePreviewIdentityData()) return;
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
  if (!canWritePreviewIdentityData()) return 0;
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
