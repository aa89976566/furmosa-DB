-- POS 共用帳務 v1：結算來源唯一明細 + Settlement 增量欄位
--
-- 本檔在本輪「只產生、不套用」。任何資料庫都不執行。
-- 上線前必須先關閉 Production migration drift 閘門（docs/POS-02-MIGRATION-PLAN.md §2），
-- 該閘門本輪未經驗證。
--
-- 設計約束：
-- * 新表建立即帶齊全部約束，禁止先建裸表下一輪再補。
-- * 稽核不得連帶刪除：SettlementSourceItem -> Settlement 使用 ON DELETE RESTRICT。
-- * active canonical unique 為 partial unique index，Prisma schema 無法表達，於此手寫。
-- * legacy 欄位型別不變；新增金額欄為整數台幣（INTEGER），不使用 DOUBLE PRECISION。
-- * 全部新增欄位 nullable 且不 backfill，舊流程維持 NULL。
-- * 新表建立後立即收回公用角色權限並啟用 RLS，避免逐筆帳務經 Data API 曝露。
--   只處理本檔新建的表，不改全域 default privileges，也不動既有表。

-- AlterTable：Settlement 增量欄位
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "rulesVersion" TEXT;
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "payloadFingerprint" TEXT;
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "createdSource" TEXT;
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "intendedPaymentMethod" TEXT;
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "netPayableTwd" INTEGER;
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "storeCollected" INTEGER;

-- 同 key 只能有一張結算。並行同 key 必須由這個約束收斂到同一張。
CREATE UNIQUE INDEX IF NOT EXISTS "Settlement_idempotencyKey_key"
ON "Settlement"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "Settlement_rulesVersion_idx"
ON "Settlement"("rulesVersion");

-- 新版結算必須同時具備 rulesVersion / idempotencyKey / payloadFingerprint /
-- netPayableTwd / storeCollected。legacy 結算五者皆為 NULL。
-- 不允許半套狀態：讀取端必須能 fail closed，不得以 0 代替缺失的金額。
DO $$ BEGIN
  ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_rules_version_completeness_check"
  CHECK (
    ("rulesVersion" IS NULL
      AND "idempotencyKey" IS NULL
      AND "payloadFingerprint" IS NULL
      AND "netPayableTwd" IS NULL
      AND "storeCollected" IS NULL)
    OR
    ("rulesVersion" IS NOT NULL
      AND "idempotencyKey" IS NOT NULL
      AND "payloadFingerprint" IS NOT NULL
      AND "netPayableTwd" IS NOT NULL
      AND "storeCollected" IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable：結算來源唯一明細
CREATE TABLE IF NOT EXISTS "SettlementSourceItem" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "originalAmount" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER,
    "unitPrice" DOUBLE PRECISION,
    "commissionAmount" DOUBLE PRECISION,
    "companyRevenue" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "relatedOrderId" TEXT,
    "sourceSnapshot" JSONB NOT NULL,
    "rulesVersion" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementSourceItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SettlementSourceItem_sourceKind_check"
      CHECK ("sourceKind" IN ('consignment_sale', 'store_collection', 'coupon_subsidy')),
    CONSTRAINT "SettlementSourceItem_direction_check"
      CHECK ("direction" IN ('STORE_TO_FURMOSA', 'FURMOSA_TO_STORE')),
    CONSTRAINT "SettlementSourceItem_sourceKey_not_blank_check"
      CHECK (length(btrim("sourceKey")) > 0),
    CONSTRAINT "SettlementSourceItem_rulesVersion_not_blank_check"
      CHECK (length(btrim("rulesVersion")) > 0)
);

-- Supabase 在 public schema 設了 default privileges，把新建表的全部權限授予 anon 與
-- authenticated。授權是在 CREATE TABLE 當下套用的，所以緊接著在這裡收回，不留空窗。
-- 兩層防護：REVOKE 讓新表從 Data API 的可見面消失；無 policy 的 RLS 是後備層，
-- 即使日後有人誤下大範圍 GRANT，資料仍然讀不到。
--
-- 刻意不做的事：
-- * 不用 FORCE ROW LEVEL SECURITY。表擁有者預設繞過 RLS，而 migration 與伺服器是
--   同一個 owner 角色；一旦 FORCE，伺服器自己就讀不到資料。
-- * 不新增任何 policy。新表沒有任何「該公開」的列。
-- * 不改 ALTER DEFAULT PRIVILEGES，不改 schema 層 USAGE，不動既有表。
-- * 不收回 service_role：它需要伺服器機密才能使用，屬於另一個工作包。
--
-- 下面三個語句都可重複執行。anon／authenticated 在隔離的本機測試庫通常不存在，
-- 因此以 pg_roles 判存後才 REVOKE，缺角色不得讓整份 migration 失敗。
-- ===== SETTLEMENT-SOURCE-ITEM-EXPOSURE-GUARD-BEGIN =====
ALTER TABLE "SettlementSourceItem" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "SettlementSourceItem" FROM PUBLIC;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "SettlementSourceItem" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "SettlementSourceItem" FROM authenticated;
  END IF;
END
$guard$;
-- ===== SETTLEMENT-SOURCE-ITEM-EXPOSURE-GUARD-END =====

-- active canonical unique：未作廢的來源在同一店家只能屬於一張結算。
-- 撤回時寫入 voidedAt 釋放此鍵，稽核列仍然保留。
CREATE UNIQUE INDEX IF NOT EXISTS "SettlementSourceItem_active_source_key"
ON "SettlementSourceItem"("merchantId", "sourceKey")
WHERE "voidedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "SettlementSourceItem_settlementId_idx"
ON "SettlementSourceItem"("settlementId");

CREATE INDEX IF NOT EXISTS "SettlementSourceItem_merchantId_sourceKey_idx"
ON "SettlementSourceItem"("merchantId", "sourceKey");

CREATE INDEX IF NOT EXISTS "SettlementSourceItem_sourceKind_idx"
ON "SettlementSourceItem"("sourceKind");

-- RESTRICT：帶有來源明細的結算不得被刪除，稽核不可連帶消失。
DO $$ BEGIN
  ALTER TABLE "SettlementSourceItem"
  ADD CONSTRAINT "SettlementSourceItem_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RESTRICT：刪店家也不得連帶刪掉帳務稽核列。既有 Settlement.merchantId 的 CASCADE 不動。
DO $$ BEGIN
  ALTER TABLE "SettlementSourceItem"
  ADD CONSTRAINT "SettlementSourceItem_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
