-- Additive merchant commercial defaults and immutable order snapshots.
-- Existing rows remain null and continue through the legacy read path.
ALTER TABLE "Product"
    ADD COLUMN "business_tier" TEXT,
    ADD COLUMN "default_consignment_commission_mode" TEXT,
    ADD COLUMN "default_consignment_commission_value" INTEGER,
    ADD COLUMN "default_wholesale_unit_price" INTEGER,
    ADD COLUMN "consignment_enabled" BOOLEAN,
    ADD COLUMN "wholesale_enabled" BOOLEAN,
    ADD COLUMN "jar_exchange_enabled" BOOLEAN,
    ADD COLUMN "commercial_terms_version" INTEGER;

ALTER TABLE "ProductPriceTier"
    ADD COLUMN "default_wholesale_unit_price" INTEGER;

ALTER TABLE "Order"
    ADD COLUMN "merchant_order_mode" TEXT;

ALTER TABLE "OrderItem"
    ADD COLUMN "business_tier_snapshot" TEXT,
    ADD COLUMN "commercial_terms_version_snapshot" INTEGER,
    ADD COLUMN "commercial_rule_source" TEXT,
    ADD COLUMN "default_commercial_mode" TEXT,
    ADD COLUMN "default_commercial_value" INTEGER,
    ADD COLUMN "applied_commercial_mode" TEXT,
    ADD COLUMN "applied_commercial_value" INTEGER,
    ADD COLUMN "commercial_override_reason" TEXT,
    ADD COLUMN "commercial_override_by_id" TEXT,
    ADD COLUMN "commercial_override_at" TIMESTAMP(3);

CREATE TABLE "merchant_commercial_modules" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_until" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_commercial_modules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "merchant_commercial_modules_period_check"
        CHECK ("effective_until" IS NULL OR "effective_until" > "effective_from"),
    CONSTRAINT "merchant_commercial_modules_mode_check"
        CHECK ("mode" IN ('consignment', 'wholesale', 'jar_exchange'))
);

CREATE UNIQUE INDEX "merchant_commercial_modules_merchant_id_mode_effective_from_key"
    ON "merchant_commercial_modules"("merchant_id", "mode", "effective_from");
CREATE INDEX "merchant_commercial_modules_merchant_id_mode_effective_from_effective_until_idx"
    ON "merchant_commercial_modules"("merchant_id", "mode", "effective_from", "effective_until");
CREATE INDEX "merchant_commercial_modules_created_by_id_idx"
    ON "merchant_commercial_modules"("created_by_id");
CREATE INDEX "OrderItem_commercial_override_by_id_idx"
    ON "OrderItem"("commercial_override_by_id");

ALTER TABLE "merchant_commercial_modules"
    ADD CONSTRAINT "merchant_commercial_modules_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_commercial_modules"
    ADD CONSTRAINT "merchant_commercial_modules_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_commercial_override_by_id_fkey"
    FOREIGN KEY ("commercial_override_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
