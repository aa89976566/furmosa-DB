-- Admin-only unit economics. Amounts are integer cents. Null means not entered.
-- Does not insert sales, cash movements, or customer records.

ALTER TABLE "Product" ADD COLUMN "food_cost_cents" INTEGER;
ALTER TABLE "Product" ADD COLUMN "packaging_cost_cents" INTEGER;

ALTER TABLE "Product" ADD CONSTRAINT "Product_food_cost_cents_check"
  CHECK ("food_cost_cents" IS NULL OR "food_cost_cents" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_packaging_cost_cents_check"
  CHECK ("packaging_cost_cents" IS NULL OR "packaging_cost_cents" >= 0);

CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "refill_orders_product_id_idx" ON "refill_orders"("product_id");

CREATE TABLE "finance_margin_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "green_min_bps" INTEGER NOT NULL DEFAULT 4500,
  "yellow_min_bps" INTEGER NOT NULL DEFAULT 3000,
  "updated_by_user_id" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "finance_margin_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_margin_settings_bps_check" CHECK (
    "green_min_bps" > "yellow_min_bps"
    AND "green_min_bps" >= 0 AND "green_min_bps" <= 10000
    AND "yellow_min_bps" >= 0 AND "yellow_min_bps" <= 10000
  )
);

-- Formal default thresholds: green >= 45%, yellow 30% to <45%, red <30%.
INSERT INTO "finance_margin_settings" ("id", "green_min_bps", "yellow_min_bps", "updated_at")
VALUES ('default', 4500, 3000, CURRENT_TIMESTAMP);

CREATE TABLE "finance_sku_channel_costs" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "other_direct_cost_cents" INTEGER,
  "cleaning_cents" INTEGER,
  "transport_cents" INTEGER,
  "group_leader_share_cents" INTEGER,
  "center_share_cents" INTEGER,
  "updated_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "finance_sku_channel_costs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_sku_channel_costs_channel_check" CHECK (
    "channel" IN ('website', 'buyout', 'consignment', 'group_buy', 'pos', 'refill')
  ),
  CONSTRAINT "finance_sku_channel_costs_non_negative_check" CHECK (
    ("other_direct_cost_cents" IS NULL OR "other_direct_cost_cents" >= 0)
    AND ("cleaning_cents" IS NULL OR "cleaning_cents" >= 0)
    AND ("transport_cents" IS NULL OR "transport_cents" >= 0)
    AND ("group_leader_share_cents" IS NULL OR "group_leader_share_cents" >= 0)
    AND ("center_share_cents" IS NULL OR "center_share_cents" >= 0)
  ),
  CONSTRAINT "finance_sku_channel_costs_refill_only_check" CHECK (
    "channel" = 'refill'
    OR (
      "cleaning_cents" IS NULL
      AND "transport_cents" IS NULL
      AND "group_leader_share_cents" IS NULL
      AND "center_share_cents" IS NULL
    )
  )
);

CREATE UNIQUE INDEX "finance_sku_channel_costs_product_id_channel_key"
  ON "finance_sku_channel_costs"("product_id", "channel");
CREATE INDEX "finance_sku_channel_costs_channel_idx"
  ON "finance_sku_channel_costs"("channel");

ALTER TABLE "finance_sku_channel_costs"
  ADD CONSTRAINT "finance_sku_channel_costs_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "finance_cash_plans" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "opening_balance_cents" INTEGER,
  "minimum_cash_cents" INTEGER,
  "anchor_monday" DATE,
  "updated_by_user_id" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "finance_cash_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "finance_cash_weeks" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "week_index" INTEGER NOT NULL,
  "inflow_cents" INTEGER,
  "supplier_payment_cents" INTEGER,
  "packaging_cents" INTEGER,
  "payroll_cents" INTEGER,
  "ads_cents" INTEGER,
  "logistics_cents" INTEGER,
  "sampling_cents" INTEGER,
  "updated_by_user_id" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "finance_cash_weeks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_cash_weeks_week_index_check" CHECK ("week_index" >= 0 AND "week_index" <= 12),
  CONSTRAINT "finance_cash_weeks_non_negative_check" CHECK (
    ("inflow_cents" IS NULL OR "inflow_cents" >= 0)
    AND ("supplier_payment_cents" IS NULL OR "supplier_payment_cents" >= 0)
    AND ("packaging_cents" IS NULL OR "packaging_cents" >= 0)
    AND ("payroll_cents" IS NULL OR "payroll_cents" >= 0)
    AND ("ads_cents" IS NULL OR "ads_cents" >= 0)
    AND ("logistics_cents" IS NULL OR "logistics_cents" >= 0)
    AND ("sampling_cents" IS NULL OR "sampling_cents" >= 0)
  )
);

CREATE UNIQUE INDEX "finance_cash_weeks_plan_id_week_index_key"
  ON "finance_cash_weeks"("plan_id", "week_index");

ALTER TABLE "finance_cash_weeks"
  ADD CONSTRAINT "finance_cash_weeks_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "finance_cash_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "finance_audit_logs" (
  "id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finance_audit_logs_actor_user_id_created_at_idx"
  ON "finance_audit_logs"("actor_user_id", "created_at");
CREATE INDEX "finance_audit_logs_entity_type_entity_id_idx"
  ON "finance_audit_logs"("entity_type", "entity_id");

ALTER TABLE "finance_audit_logs"
  ADD CONSTRAINT "finance_audit_logs_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
-- * 不寫入 _prisma_migrations。歷史只由 Prisma migrate deploy 記錄。
--
-- anon／authenticated 在隔離的本機測試庫通常不存在，因此以 pg_roles 判存後才 REVOKE。
-- ===== FINANCE-UNIT-ECONOMICS-EXPOSURE-GUARD-BEGIN =====
ALTER TABLE "finance_margin_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_sku_channel_costs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_cash_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_cash_weeks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_audit_logs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "finance_margin_settings" FROM PUBLIC;
REVOKE ALL ON TABLE "finance_sku_channel_costs" FROM PUBLIC;
REVOKE ALL ON TABLE "finance_cash_plans" FROM PUBLIC;
REVOKE ALL ON TABLE "finance_cash_weeks" FROM PUBLIC;
REVOKE ALL ON TABLE "finance_audit_logs" FROM PUBLIC;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "finance_margin_settings" FROM anon;
    REVOKE ALL ON TABLE "finance_sku_channel_costs" FROM anon;
    REVOKE ALL ON TABLE "finance_cash_plans" FROM anon;
    REVOKE ALL ON TABLE "finance_cash_weeks" FROM anon;
    REVOKE ALL ON TABLE "finance_audit_logs" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "finance_margin_settings" FROM authenticated;
    REVOKE ALL ON TABLE "finance_sku_channel_costs" FROM authenticated;
    REVOKE ALL ON TABLE "finance_cash_plans" FROM authenticated;
    REVOKE ALL ON TABLE "finance_cash_weeks" FROM authenticated;
    REVOKE ALL ON TABLE "finance_audit_logs" FROM authenticated;
  END IF;
END
$guard$;
-- ===== FINANCE-UNIT-ECONOMICS-EXPOSURE-GUARD-END =====
