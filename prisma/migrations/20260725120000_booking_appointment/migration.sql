-- Booking MVP Round 1: Appointment + merchant shared schedule fields
-- Customer books the merchant (not a technician). No LINE / payment / jar.

ALTER TABLE "merchant_settings" ADD COLUMN "booking_open_time" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "merchant_settings" ADD COLUMN "booking_close_time" TEXT NOT NULL DEFAULT '18:00';
ALTER TABLE "merchant_settings" ADD COLUMN "booking_slot_minutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "merchant_settings" ADD COLUMN "booking_capacity_per_slot" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "merchant_settings" ADD COLUMN "booking_weekdays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6';

CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_product_id" TEXT,
    "service_name" TEXT NOT NULL,
    "pet_name" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "customer_note" TEXT,
    "merchant_note" TEXT,
    "proposed_starts_at" TIMESTAMP(3),
    "proposed_ends_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "is_overbooked" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointments_merchant_id_starts_at_idx" ON "appointments"("merchant_id", "starts_at");
CREATE INDEX "appointments_merchant_id_status_idx" ON "appointments"("merchant_id", "status");
CREATE INDEX "appointments_customer_id_created_at_idx" ON "appointments"("customer_id", "created_at");

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_product_id_fkey" FOREIGN KEY ("service_product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
