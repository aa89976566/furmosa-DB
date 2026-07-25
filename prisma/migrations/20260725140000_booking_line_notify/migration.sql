-- Booking MVP Round 2: LINE confirmation + reminder idempotency fields

ALTER TABLE "merchant_settings" ADD COLUMN "booking_notify_line_user_id" TEXT;

ALTER TABLE "appointments" ADD COLUMN "line_notify_received_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "line_notify_merchant_new_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "line_notify_confirmed_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "line_reminder_1d_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "line_reminder_2h_at" TIMESTAMP(3);

CREATE INDEX "appointments_status_starts_at_reminder_idx"
  ON "appointments"("status", "starts_at");
