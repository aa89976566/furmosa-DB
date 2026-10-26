CREATE TABLE "shopify_catalog_candidates" (
  "id" TEXT NOT NULL,
  "shopify_product_id" TEXT NOT NULL,
  "shopify_variant_id" TEXT NOT NULL,
  "product_title" TEXT NOT NULL,
  "variant_title" TEXT NOT NULL,
  "sku" TEXT,
  "price" DECIMAL(12,2) NOT NULL,
  "shopify_status" TEXT NOT NULL,
  "resolution" TEXT NOT NULL DEFAULT 'pending',
  "linked_product_id" TEXT,
  "linked_tier_id" TEXT,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "resolved_by_id" TEXT,
  "notes" TEXT,
  CONSTRAINT "shopify_catalog_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopify_catalog_candidates_shopify_variant_id_key"
  ON "shopify_catalog_candidates"("shopify_variant_id");
CREATE INDEX "shopify_catalog_candidates_resolution_last_seen_at_idx"
  ON "shopify_catalog_candidates"("resolution", "last_seen_at");
CREATE INDEX "shopify_catalog_candidates_shopify_product_id_idx"
  ON "shopify_catalog_candidates"("shopify_product_id");
CREATE INDEX "shopify_catalog_candidates_sku_idx"
  ON "shopify_catalog_candidates"("sku");
