-- Additive foundation only. No backfill and no automatic enrollment into OMS.
-- Apply only after an isolated database has been confirmed and application approved.
CREATE TYPE "OmsStatus" AS ENUM ('NEW', 'REVIEW', 'READY', 'FULFILLMENT_PENDING', 'FULFILLED');
CREATE TYPE "ShopifyWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

ALTER TABLE "Order"
  ADD COLUMN "oms_status" "OmsStatus",
  ADD COLUMN "oms_issue_flags" JSONB,
  ADD COLUMN "oms_checked_at" TIMESTAMP(3),
  ADD COLUMN "oms_checked_source_updated_at" TIMESTAMP(3),
  ADD COLUMN "shopify_snapshot" JSONB,
  ADD COLUMN "shopify_source_updated_at" TIMESTAMP(3),
  ADD COLUMN "shopify_last_event_id" TEXT,
  ADD COLUMN "oms_reviewed_by_id" TEXT,
  ADD COLUMN "oms_reviewed_at" TIMESTAMP(3);

CREATE TABLE "ShopifyWebhookEvent" (
  "id" TEXT NOT NULL,
  "shopDomain" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "externalOrderId" TEXT,
  "sourceUpdatedAt" TIMESTAMP(3),
  "payload" JSONB,
  "payloadHash" TEXT NOT NULL,
  "payloadExpiresAt" TIMESTAMP(3),
  "status" "ShopifyWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lockedUntil" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  CONSTRAINT "ShopifyWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Server-side Prisma owns this inbox; never expose webhook payloads through the Data API.
ALTER TABLE "ShopifyWebhookEvent" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX "ShopifyWebhookEvent_shopDomain_topic_eventId_key"
  ON "ShopifyWebhookEvent"("shopDomain", "topic", "eventId");
CREATE INDEX "ShopifyWebhookEvent_status_nextAttemptAt_idx"
  ON "ShopifyWebhookEvent"("status", "nextAttemptAt");
CREATE INDEX "ShopifyWebhookEvent_shopDomain_externalOrderId_idx"
  ON "ShopifyWebhookEvent"("shopDomain", "externalOrderId");
CREATE INDEX "ShopifyWebhookEvent_payloadExpiresAt_idx"
  ON "ShopifyWebhookEvent"("payloadExpiresAt");
CREATE INDEX "Order_oms_status_orderedAt_idx" ON "Order"("oms_status", "orderedAt");
CREATE INDEX "Order_oms_reviewed_by_id_idx" ON "Order"("oms_reviewed_by_id");
ALTER TABLE "Order" ADD CONSTRAINT "Order_oms_reviewed_by_id_fkey"
  FOREIGN KEY ("oms_reviewed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
