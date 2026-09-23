-- Additive POS dispatch inbox. Existing shipments are not backfilled as unread.
CREATE TABLE "merchant_notifications" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_notifications_shipment_id_kind_key"
    ON "merchant_notifications"("shipment_id", "kind");
CREATE INDEX "merchant_notifications_merchant_id_created_at_idx"
    ON "merchant_notifications"("merchant_id", "created_at");

CREATE TABLE "merchant_notification_reads" (
    "notification_id" TEXT NOT NULL,
    "merchant_user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_notification_reads_pkey" PRIMARY KEY ("notification_id", "merchant_user_id")
);

CREATE INDEX "merchant_notification_reads_merchant_user_id_idx"
    ON "merchant_notification_reads"("merchant_user_id");

ALTER TABLE "merchant_notifications" ADD CONSTRAINT "merchant_notifications_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_notifications" ADD CONSTRAINT "merchant_notifications_shipment_id_fkey"
    FOREIGN KEY ("shipment_id") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_notification_reads" ADD CONSTRAINT "merchant_notification_reads_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "merchant_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_notification_reads" ADD CONSTRAINT "merchant_notification_reads_merchant_user_id_fkey"
    FOREIGN KEY ("merchant_user_id") REFERENCES "merchant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
