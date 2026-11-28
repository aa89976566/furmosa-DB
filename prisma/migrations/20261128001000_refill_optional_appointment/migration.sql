-- Keep the existing foreign key and historical appointment links.
ALTER TABLE "refill_orders" ALTER COLUMN "appointment_id" DROP NOT NULL;
