CREATE TYPE "ProductTemperature" AS ENUM ('ambient', 'chilled', 'frozen');

ALTER TABLE "Product"
ADD COLUMN "default_temperature" "ProductTemperature";
