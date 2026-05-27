-- Migrate supply station -> jar exchange membership

-- Drop legacy supply tables (data migrated below where possible)
DROP TABLE IF EXISTS "supply_redemptions";
DROP TABLE IF EXISTS "return_events";
DROP TABLE IF EXISTS "return_codes";
DROP TABLE IF EXISTS "supply_rewards";
DROP TABLE IF EXISTS "supply_members";

-- Customer services
CREATE TABLE "customer_services" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "service_status" TEXT NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_services_customer_id_service_type_key" ON "customer_services"("customer_id", "service_type");
CREATE INDEX "customer_services_service_type_service_status_idx" ON "customer_services"("service_type", "service_status");

ALTER TABLE "customer_services" ADD CONSTRAINT "customer_services_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Jar codes
CREATE TABLE "jar_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "batch_no" TEXT,
    "product_sku" TEXT,
    "point_value" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'unused',
    "redeemed_by_customer_id" TEXT,
    "redeemed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jar_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jar_codes_code_key" ON "jar_codes"("code");
CREATE INDEX "jar_codes_status_idx" ON "jar_codes"("status");
CREATE INDEX "jar_codes_batch_no_idx" ON "jar_codes"("batch_no");
CREATE INDEX "jar_codes_redeemed_by_customer_id_idx" ON "jar_codes"("redeemed_by_customer_id");

ALTER TABLE "jar_codes" ADD CONSTRAINT "jar_codes_redeemed_by_customer_id_fkey" FOREIGN KEY ("redeemed_by_customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Points ledger
CREATE TABLE "member_points_ledger" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_ref_id" TEXT,
    "points_change" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_points_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "member_points_ledger_customer_id_created_at_idx" ON "member_points_ledger"("customer_id", "created_at");
CREATE INDEX "member_points_ledger_source_type_idx" ON "member_points_ledger"("source_type");

ALTER TABLE "member_points_ledger" ADD CONSTRAINT "member_points_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_points_ledger" ADD CONSTRAINT "member_points_ledger_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reward catalog
CREATE TABLE "reward_catalog" (
    "id" TEXT NOT NULL,
    "reward_code" TEXT NOT NULL,
    "reward_name" TEXT NOT NULL,
    "reward_type" TEXT NOT NULL DEFAULT 'grooming_coupon',
    "points_required" INTEGER NOT NULL,
    "coupon_face_value" DOUBLE PRECISION NOT NULL,
    "internal_cost" DOUBLE PRECISION NOT NULL,
    "partner_merchant_id" TEXT,
    "active_status" TEXT NOT NULL DEFAULT 'active',
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reward_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reward_catalog_reward_code_key" ON "reward_catalog"("reward_code");
CREATE INDEX "reward_catalog_active_status_idx" ON "reward_catalog"("active_status");

ALTER TABLE "reward_catalog" ADD CONSTRAINT "reward_catalog_partner_merchant_id_fkey" FOREIGN KEY ("partner_merchant_id") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reward redemptions
CREATE TABLE "reward_redemptions" (
    "id" TEXT NOT NULL,
    "redemption_code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "points_spent" INTEGER NOT NULL,
    "coupon_code" TEXT,
    "coupon_status" TEXT NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    "partner_merchant_id" TEXT,
    "cost_booked_status" TEXT NOT NULL DEFAULT 'booked',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reward_redemptions_redemption_code_key" ON "reward_redemptions"("redemption_code");
CREATE INDEX "reward_redemptions_customer_id_idx" ON "reward_redemptions"("customer_id");
CREATE INDEX "reward_redemptions_coupon_status_idx" ON "reward_redemptions"("coupon_status");

ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "reward_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_partner_merchant_id_fkey" FOREIGN KEY ("partner_merchant_id") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Marketing cost records
CREATE TABLE "marketing_cost_records" (
    "id" TEXT NOT NULL,
    "cost_code" TEXT NOT NULL,
    "redemption_id" TEXT,
    "customer_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "cost_category" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'accrued',
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_cost_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketing_cost_records_cost_code_key" ON "marketing_cost_records"("cost_code");
CREATE UNIQUE INDEX "marketing_cost_records_redemption_id_key" ON "marketing_cost_records"("redemption_id");
CREATE INDEX "marketing_cost_records_booked_at_idx" ON "marketing_cost_records"("booked_at");
CREATE INDEX "marketing_cost_records_cost_category_idx" ON "marketing_cost_records"("cost_category");

ALTER TABLE "marketing_cost_records" ADD CONSTRAINT "marketing_cost_records_redemption_id_fkey" FOREIGN KEY ("redemption_id") REFERENCES "reward_redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_cost_records" ADD CONSTRAINT "marketing_cost_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
