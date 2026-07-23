-- Phase 2: ProductCategory + MerchantSettings + RestockRequest (additive)
-- product_category uses String values (app enum), not Prisma enum tables.

ALTER TABLE "Product" ADD COLUMN "product_category" TEXT NOT NULL DEFAULT 'STANDARD';

CREATE INDEX "Product_product_category_idx" ON "Product"("product_category");

-- One-time backfill from legacy name-prefix convention (do not rely on prefix going forward)
UPDATE "Product"
SET "product_category" = 'JAR_EXCHANGE'
WHERE "name" LIKE '換罐%';

CREATE TABLE "merchant_settings" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "waiting_for_jar_days" INTEGER NOT NULL DEFAULT 14,
    "appointment_enabled" BOOLEAN NOT NULL DEFAULT false,
    "line_notification_enabled" BOOLEAN NOT NULL DEFAULT true,
    "allow_auto_approve_restock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_settings_merchant_id_key" ON "merchant_settings"("merchant_id");

ALTER TABLE "merchant_settings" ADD CONSTRAINT "merchant_settings_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "restock_requests" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "requested_by_merchant_user_id" TEXT NOT NULL,
    "request_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "merchant_note" TEXT,
    "hq_note" TEXT,
    "expected_arrival_date" TIMESTAMP(3),
    "approved_snapshot" JSONB,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "shipment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restock_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "restock_requests_shipment_id_key" ON "restock_requests"("shipment_id");
CREATE INDEX "restock_requests_merchant_id_status_idx" ON "restock_requests"("merchant_id", "status");
CREATE INDEX "restock_requests_status_created_at_idx" ON "restock_requests"("status", "created_at");

ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_requested_by_merchant_user_id_fkey" FOREIGN KEY ("requested_by_merchant_user_id") REFERENCES "merchant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "restock_request_items" (
    "id" TEXT NOT NULL,
    "restock_request_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "requested_quantity" INTEGER,
    "approved_quantity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restock_request_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "restock_request_items_restock_request_id_idx" ON "restock_request_items"("restock_request_id");
CREATE INDEX "restock_request_items_product_id_idx" ON "restock_request_items"("product_id");

ALTER TABLE "restock_request_items" ADD CONSTRAINT "restock_request_items_restock_request_id_fkey" FOREIGN KEY ("restock_request_id") REFERENCES "restock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "restock_request_items" ADD CONSTRAINT "restock_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
