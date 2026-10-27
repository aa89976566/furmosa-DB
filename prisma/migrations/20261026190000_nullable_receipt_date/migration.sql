-- Preserve all historical dates; unknown dates may remain null for later completion.
ALTER TABLE "purchase_receipts" ALTER COLUMN "receipt_date" DROP NOT NULL;
