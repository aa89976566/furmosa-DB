-- Additive ownership ledger. Legacy transactions are unchanged (NULL snapshot).
ALTER TABLE "MerchantStockTxn" ADD COLUMN "tierId" TEXT,
  ADD COLUMN "settlementQuantity" INTEGER,
  ADD COLUMN "commercialMode" TEXT,
  ADD COLUMN "inventoryAllocation" JSONB;
ALTER TABLE "MerchantStockTxn" ADD CONSTRAINT "stock_txn_settlement_quantity_check"
  CHECK ("settlementQuantity" IS NULL OR ("settlementQuantity" >= 0 AND "settlementQuantity" <= abs(quantity)));
CREATE TABLE "MerchantStockLot" (
  id TEXT PRIMARY KEY,
  "stockId" TEXT NOT NULL REFERENCES "MerchantStock"(id) ON DELETE RESTRICT,
  "sourceKey" TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('consignment','wholesale')),
  "initialQuantity" INTEGER NOT NULL CHECK ("initialQuantity">=0),
  "remainingQuantity" INTEGER NOT NULL CHECK ("remainingQuantity">=0 AND "remainingQuantity"<="initialQuantity"),
  "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  gift BOOLEAN NOT NULL DEFAULT false,
  note TEXT
);
CREATE INDEX "MerchantStockLot_stockId_acquiredAt_idx" ON "MerchantStockLot"("stockId","acquiredAt");
ALTER TABLE "MerchantStockLot" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "MerchantStockLot" FROM PUBLIC;

-- Applies to HQ and POS writes, so a secondary sales entry cannot bypass ownership.
-- Invoker rights only; no public privileged RPC. Stock and its transaction MUST be
-- written in the same application transaction (see the shared sales writers).
CREATE FUNCTION merchant_inventory_ownership_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  st "MerchantStock"%ROWTYPE;
  lot "MerchantStockLot"%ROWTYPE;
  item RECORD;
  tier TEXT;
  tracked INTEGER;
  before_qty INTEGER;
  needed INTEGER;
  taken INTEGER;
  billable INTEGER := 0;
  source_mode TEXT;
  allocation JSONB := '[]'::jsonb;
BEGIN
  tier := NEW."tierId";
  IF NEW."shipmentItemId" IS NOT NULL THEN
    SELECT i."variantKey", i."weightGrams", s."orderId", o.merchant_order_mode,
           s."merchantId", i."productId"
      INTO item FROM "ShipmentItem" i JOIN "Shipment" s ON s.id=i."shipmentId"
      LEFT JOIN "Order" o ON o.id=s."orderId" WHERE i.id=NEW."shipmentItemId";
    IF item."merchantId" IS DISTINCT FROM NEW."merchantId" OR item."productId" IS DISTINCT FROM NEW."productId" THEN
      RAISE EXCEPTION 'Shipment ownership mismatch';
    END IF;
    tier := coalesce(tier,item."variantKey");
    source_mode := CASE WHEN item.merchant_order_mode='wholesale' THEN 'wholesale' ELSE 'consignment' END;
  END IF;
  -- Old entrypoints without tier identity remain compatible only for untracked
  -- products. Never guess between multiple owned stock buckets.
  IF tier IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM "MerchantStockLot" l JOIN "MerchantStock" s ON s.id=l."stockId"
      WHERE s."merchantId"=NEW."merchantId" AND s."productId"=NEW."productId") THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Tracked inventory requires an explicit tier';
  END IF;
  SELECT * INTO st FROM "MerchantStock" WHERE "merchantId"=NEW."merchantId"
    AND "productId"=NEW."productId" AND "tierId"=tier FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing stock bucket'; END IF;
  NEW."tierId" := tier;
  SELECT coalesce(sum("remainingQuantity"),0) INTO tracked FROM "MerchantStockLot" WHERE "stockId"=st.id;
  before_qty := st.quantity-NEW.quantity;

  IF NEW.quantity>0 AND source_mode IS NULL AND EXISTS(SELECT 1 FROM "MerchantStockLot" WHERE "stockId"=st.id) THEN
    RAISE EXCEPTION '新增已分批庫存須使用有合作方式的補貨單';
  END IF;
  IF NEW.quantity>0 AND (source_mode='wholesale' OR EXISTS(SELECT 1 FROM "MerchantStockLot" WHERE "stockId"=st.id)) THEN
    IF tracked>before_qty THEN RAISE EXCEPTION 'Inventory lot balance differs from stock'; END IF;
    IF tracked<before_qty THEN
      INSERT INTO "MerchantStockLot"(id,"stockId","sourceKey",mode,"initialQuantity","remainingQuantity","acquiredAt",note)
        VALUES(gen_random_uuid()::text,st.id,'legacy:'||NEW.id,'consignment',before_qty-tracked,before_qty-tracked,'1970-01-01','Explicit legacy opening balance');
    END IF;
    INSERT INTO "MerchantStockLot"(id,"stockId","sourceKey",mode,"initialQuantity","remainingQuantity","acquiredAt")
      VALUES(gen_random_uuid()::text,st.id,'receipt:'||NEW.id,coalesce(source_mode,'consignment'),NEW.quantity,NEW.quantity,NEW."createdAt");
    NEW."commercialMode" := coalesce(source_mode,'consignment');
    RETURN NEW;
  END IF;
  IF NEW.quantity>=0 OR NOT EXISTS(SELECT 1 FROM "MerchantStockLot" WHERE "stockId"=st.id) THEN RETURN NEW; END IF;
  IF tracked<>before_qty THEN RAISE EXCEPTION 'Inventory lot balance differs from stock'; END IF;
  needed := -NEW.quantity;
  IF needed>tracked THEN RAISE EXCEPTION 'Insufficient owned stock'; END IF;
  FOR lot IN SELECT * FROM "MerchantStockLot" WHERE "stockId"=st.id AND "remainingQuantity">0
    ORDER BY "acquiredAt",id FOR UPDATE LOOP
    taken := least(needed,lot."remainingQuantity");
    UPDATE "MerchantStockLot" SET "remainingQuantity"="remainingQuantity"-taken WHERE id=lot.id;
    allocation := allocation||jsonb_build_array(jsonb_build_object('lotId',lot.id,'mode',lot.mode,'quantity',taken,'gift',lot.gift));
    IF lot.mode='consignment' THEN billable:=billable+taken; END IF;
    needed := needed-taken;
    EXIT WHEN needed=0;
  END LOOP;
  NEW."inventoryAllocation" := allocation;
  NEW."commercialMode" := CASE WHEN billable=0 THEN 'wholesale' WHEN billable=-NEW.quantity THEN 'consignment' ELSE 'mixed' END;
  IF NEW.type='sale' THEN
    NEW."settlementQuantity" := billable;
    NEW."commissionAmount" := coalesce(NEW."commissionAmount",0)*billable/(-NEW.quantity);
    NEW."companyRevenue" := coalesce(NEW."unitPrice",0)*billable-NEW."commissionAmount";
  ELSE
    -- Counts, damage and returns are inventory events, never implicit sales.
    NEW."settlementQuantity" := 0;
    NEW."unitPrice" := 0; NEW."commissionAmount" := 0; NEW."companyRevenue" := 0;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION merchant_inventory_ownership_insert() FROM PUBLIC;
CREATE TRIGGER merchant_inventory_ownership_insert BEFORE INSERT ON "MerchantStockTxn"
  FOR EACH ROW EXECUTE FUNCTION merchant_inventory_ownership_insert();

-- Existing undo restores the stock first. Restore exactly the original batches;
-- never manufacture consignment inventory when undoing a bought-out sale.
CREATE FUNCTION merchant_inventory_ownership_undo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE entry JSONB;
BEGIN
  IF OLD."inventoryAllocation" IS NOT NULL THEN
    IF OLD."settlementId" IS NOT NULL THEN RAISE EXCEPTION 'Settled inventory cannot be undone'; END IF;
    FOR entry IN SELECT * FROM jsonb_array_elements(OLD."inventoryAllocation") LOOP
      UPDATE "MerchantStockLot" SET "remainingQuantity"="remainingQuantity"+(entry->>'quantity')::int
        WHERE id=entry->>'lotId';
      IF NOT FOUND THEN RAISE EXCEPTION 'Original inventory lot is missing'; END IF;
    END LOOP;
  END IF;
  IF EXISTS(SELECT 1 FROM "MerchantStockLot" WHERE "sourceKey"='receipt:'||OLD.id) THEN
    RAISE EXCEPTION 'Owned stock receipt cannot be deleted; use a return';
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION merchant_inventory_ownership_undo() FROM PUBLIC;
CREATE TRIGGER merchant_inventory_ownership_undo BEFORE DELETE ON "MerchantStockTxn"
  FOR EACH ROW EXECUTE FUNCTION merchant_inventory_ownership_undo();

CREATE FUNCTION merchant_inventory_ownership_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (OLD."inventoryAllocation" IS NOT NULL OR EXISTS(SELECT 1 FROM "MerchantStockLot" WHERE "sourceKey"='receipt:'||OLD.id)) AND
     (to_jsonb(NEW)-'settlementId'-'note') IS DISTINCT FROM (to_jsonb(OLD)-'settlementId'-'note') THEN
    RAISE EXCEPTION 'Owned inventory snapshot is immutable; reverse the original movement';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION merchant_inventory_ownership_immutable() FROM PUBLIC;
CREATE TRIGGER merchant_inventory_ownership_immutable BEFORE UPDATE ON "MerchantStockTxn"
  FOR EACH ROW EXECUTE FUNCTION merchant_inventory_ownership_immutable();
