-- AlterTable: 店家類型改為可複選陣列
ALTER TABLE "Merchant" ADD COLUMN "types" TEXT[] DEFAULT ARRAY['consignment']::TEXT[];

UPDATE "Merchant"
SET "types" = ARRAY["type"]
WHERE "types" IS NULL OR cardinality("types") = 0;
