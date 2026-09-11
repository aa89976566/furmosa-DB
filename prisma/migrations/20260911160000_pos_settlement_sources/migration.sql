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

-- 新版結算必須同時具備 rulesVersion / idempotencyKey / payloadFingerprint / netPayableTwd。
-- legacy 結算四者皆為 NULL。不允許半套狀態，避免讀取端猜測版本。
DO $$ BEGIN
  ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_rules_version_completeness_check"
  CHECK (
    ("rulesVersion" IS NULL
      AND "idempotencyKey" IS NULL
      AND "payloadFingerprint" IS NULL
      AND "netPayableTwd" IS NULL)
    OR
    ("rulesVersion" IS NOT NULL
      AND "idempotencyKey" IS NOT NULL
      AND "payloadFingerprint" IS NOT NULL
      AND "netPayableTwd" IS NOT NULL)
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

-- merchant 沿用既有 Settlement 的 CASCADE 語意，不改變店家刪除行為。
DO $$ BEGIN
  ALTER TABLE "SettlementSourceItem"
  ADD CONSTRAINT "SettlementSourceItem_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
