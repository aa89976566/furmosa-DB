import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isMissingCampaignTableError } from '@/lib/campaigns/jiba-two-piece/missing-table';

/**
 * 生產環境 build 對 `prisma migrate deploy` 採 soft-fail，
 * 開箱活動表可能尚未建立。報名／HQ 審核前以 idempotent DDL 補齊。
 *
 * - 先探測表是否已存在，已就緒則只補 seed
 * - DDL 優先走 DIRECT_URL（避開 pooler 對 DO $$／DDL 的限制）
 * - 逐條執行；外鍵失敗只警告，不拖垮讀取路徑
 */

const SEED_CAMPAIGN_SQL = `INSERT INTO "campaigns" ("id", "slug", "name", "status", "cover_image_url", "product_name", "product_quantity", "product_unit_price", "shipping_fee", "license_version", "created_at", "updated_at")
VALUES (
  'camp_jiba_two_piece',
  'jiba-two-piece',
  '雞霸兩片開箱',
  'active',
  '/line/events/jiba-unbox-cover.png',
  '雞霸',
  2,
  0,
  60,
  'ugc-v1',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("slug") DO NOTHING`;

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "campaigns" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cover_image_url" TEXT,
    "product_name" TEXT NOT NULL DEFAULT '雞霸',
    "product_quantity" INTEGER NOT NULL DEFAULT 2,
    "product_unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipping_fee" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "license_version" TEXT NOT NULL DEFAULT 'ugc-v1',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_slug_key" ON "campaigns"("slug")`,
  `CREATE TABLE IF NOT EXISTS "campaign_applications" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "line_user_id" TEXT NOT NULL,
    "line_display_name" TEXT,
    "order_id" TEXT,
    "instagram_handle" TEXT,
    "pet_name" TEXT,
    "recipient_name" TEXT,
    "recipient_phone" TEXT,
    "store_id" TEXT,
    "store_name" TEXT,
    "store_address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COLLECTING_INFO',
    "shipping_queue_status" TEXT NOT NULL DEFAULT 'NOT_READY',
    "license_accepted" BOOLEAN NOT NULL DEFAULT false,
    "license_version" TEXT,
    "license_accepted_at" TIMESTAMP(3),
    "license_source_message_id" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "return_fields" TEXT,
    "payment_token" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_applications_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "campaign_applications_order_id_key" ON "campaign_applications"("order_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "campaign_applications_payment_token_key" ON "campaign_applications"("payment_token")`,
  `CREATE INDEX IF NOT EXISTS "campaign_applications_campaign_id_status_idx" ON "campaign_applications"("campaign_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "campaign_applications_line_user_id_status_idx" ON "campaign_applications"("line_user_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "campaign_applications_order_id_idx" ON "campaign_applications"("order_id")`,
  `CREATE TABLE IF NOT EXISTS "conversation_sessions" (
    "id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "campaign_application_id" TEXT NOT NULL,
    "current_state" TEXT NOT NULL,
    "collected_data_json" TEXT NOT NULL DEFAULT '{}',
    "operator_takeover" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "conversation_sessions_campaign_application_id_key" ON "conversation_sessions"("campaign_application_id")`,
  `CREATE INDEX IF NOT EXISTS "conversation_sessions_line_user_id_current_state_idx" ON "conversation_sessions"("line_user_id", "current_state")`,
  `CREATE TABLE IF NOT EXISTS "conversation_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "line_message_id" TEXT,
    "sender_type" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "content_json" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "conversation_messages_session_id_sent_at_idx" ON "conversation_messages"("session_id", "sent_at")`,
  `CREATE TABLE IF NOT EXISTS "order_reviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "order_id" TEXT,
    "reviewer_id" TEXT,
    "reviewer_name" TEXT,
    "decision" TEXT NOT NULL,
    "reason_code" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_reviews_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "order_reviews_application_id_idx" ON "order_reviews"("application_id")`,
  `CREATE TABLE IF NOT EXISTS "status_audit_logs" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "metadata_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "application_id" TEXT,
    CONSTRAINT "status_audit_logs_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "status_audit_logs_entity_type_entity_id_idx" ON "status_audit_logs"("entity_type", "entity_id")`,
  `CREATE INDEX IF NOT EXISTS "status_audit_logs_application_id_idx" ON "status_audit_logs"("application_id")`,
];

const FK_STATEMENTS = [
  `DO $$ BEGIN
  ALTER TABLE "campaign_applications"
    ADD CONSTRAINT "campaign_applications_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "conversation_sessions"
    ADD CONSTRAINT "conversation_sessions_campaign_application_id_fkey"
    FOREIGN KEY ("campaign_application_id") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "conversation_messages"
    ADD CONSTRAINT "conversation_messages_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "order_reviews"
    ADD CONSTRAINT "order_reviews_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "campaign_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "status_audit_logs"
    ADD CONSTRAINT "status_audit_logs_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "campaign_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
];

let schemaReady: Promise<void> | null = null;

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
  // DIRECT_URL 專供 migrate／DDL；與 runtime pooler 不同時才另開 client
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

async function campaignsTableReady(db: PrismaClient): Promise<boolean> {
  try {
    await db.$queryRawUnsafe(`SELECT 1 FROM "campaigns" LIMIT 1`);
    return true;
  } catch (err) {
    if (isMissingCampaignTableError(err)) return false;
    // 連線類錯誤往外拋，讓呼叫端決定重試／錯誤頁
    throw err;
  }
}

async function execSql(db: PrismaClient, sql: string, soft: boolean) {
  try {
    await db.$executeRawUnsafe(sql);
  } catch (err) {
    if (soft || isSoftDdlError(err)) {
      console.warn('[jiba-two-piece] DDL statement skipped', {
        soft,
        message: err instanceof Error ? err.message : String(err),
        preview: sql.slice(0, 80).replace(/\s+/g, ' '),
      });
      return;
    }
    throw err;
  }
}

async function runEnsureSchema() {
  await withDdlClient(async (db) => {
    const ready = await campaignsTableReady(db);
    if (!ready) {
      for (const sql of DDL_STATEMENTS) {
        await execSql(db, sql, false);
      }
      for (const sql of FK_STATEMENTS) {
        await execSql(db, sql, true);
      }
    }
    await execSql(db, SEED_CAMPAIGN_SQL, true);
    console.info('[jiba-two-piece] campaign schema ensured', { created: !ready });
  });
}

export async function ensureJibaCampaignSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = runEnsureSchema().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}
