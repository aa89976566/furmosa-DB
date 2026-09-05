-- Read-only preflight for 20260904110000_shipment_received_fields.
-- Queries + RAISE only. Do not run as a Prisma migration. Do not write data.

DO $$
DECLARE
  shipment_types text;
  shipment_statuses text;
  txn_types text;
  restock_shipment_count bigint;
  restock_delivered_or_received_count bigint;
  restock_txn_count bigint;
  restock_note_count bigint;
  existing_columns text := '';
  count_failures text := '';
BEGIN
  IF to_regclass('public."Shipment"') IS NULL THEN
    RAISE EXCEPTION 'preflight: table public."Shipment" does not exist';
  END IF;
  IF to_regclass('public."MerchantStockTxn"') IS NULL THEN
    RAISE EXCEPTION 'preflight: table public."MerchantStockTxn" does not exist';
  END IF;

  SELECT coalesce(string_agg(val, ', ' ORDER BY val), '<none>')
  INTO shipment_types
  FROM (
    SELECT DISTINCT coalesce("type", '<NULL>') AS val
    FROM public."Shipment"
  ) d;
  RAISE NOTICE 'Shipment.type DISTINCT: %', shipment_types;

  SELECT coalesce(string_agg(val, ', ' ORDER BY val), '<none>')
  INTO shipment_statuses
  FROM (
    SELECT DISTINCT coalesce(status, '<NULL>') AS val
    FROM public."Shipment"
  ) d;
  RAISE NOTICE 'Shipment.status DISTINCT: %', shipment_statuses;

  SELECT coalesce(string_agg(val, ', ' ORDER BY val), '<none>')
  INTO txn_types
  FROM (
    SELECT DISTINCT coalesce("type", '<NULL>') AS val
    FROM public."MerchantStockTxn"
  ) d;
  RAISE NOTICE 'MerchantStockTxn.type DISTINCT: %', txn_types;

  SELECT count(*)
  INTO restock_shipment_count
  FROM public."Shipment"
  WHERE "type" = 'merchant_restock';
  RAISE NOTICE 'count Shipment type=''merchant_restock'': %', restock_shipment_count;

  SELECT count(*)
  INTO restock_delivered_or_received_count
  FROM public."Shipment"
  WHERE "type" = 'merchant_restock'
    AND status IN ('delivered', 'received');
  RAISE NOTICE 'count Shipment type=''merchant_restock'' AND status IN (''delivered'',''received''): %', restock_delivered_or_received_count;

  SELECT count(*)
  INTO restock_txn_count
  FROM public."MerchantStockTxn"
  WHERE "type" = 'restock';
  RAISE NOTICE 'count MerchantStockTxn type=''restock'': %', restock_txn_count;

  SELECT count(*)
  INTO restock_note_count
  FROM public."MerchantStockTxn"
  WHERE note LIKE '%來自出貨單%'
     OR note LIKE '%[來源] 出貨紀錄%';
  RAISE NOTICE 'count MerchantStockTxn note LIKE 來自出貨單 or [來源] 出貨紀錄: %', restock_note_count;

  IF restock_shipment_count <> 0 THEN
    count_failures := count_failures || format(' Shipment type=''merchant_restock'' count=%s;', restock_shipment_count);
  END IF;
  IF restock_delivered_or_received_count <> 0 THEN
    count_failures := count_failures || format(' Shipment type=''merchant_restock'' status IN (''delivered'',''received'') count=%s;', restock_delivered_or_received_count);
  END IF;
  IF restock_txn_count <> 0 THEN
    count_failures := count_failures || format(' MerchantStockTxn type=''restock'' count=%s;', restock_txn_count);
  END IF;
  IF restock_note_count <> 0 THEN
    count_failures := count_failures || format(' MerchantStockTxn note LIKE ''%%來自出貨單%%'' OR ''%%[來源] 出貨紀錄%%'' count=%s;', restock_note_count);
  END IF;
  IF count_failures <> '' THEN
    RAISE EXCEPTION 'preflight: expected 0 rows, found:%', count_failures;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Shipment'
      AND column_name = 'receivedAt'
  ) THEN
    existing_columns := existing_columns || ' Shipment.receivedAt';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Shipment'
      AND column_name = 'receivedByMerchantUserId'
  ) THEN
    existing_columns := existing_columns || ' Shipment.receivedByMerchantUserId';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'MerchantStockTxn'
      AND column_name = 'shipmentItemId'
  ) THEN
    existing_columns := existing_columns || ' MerchantStockTxn.shipmentItemId';
  END IF;
  IF existing_columns <> '' THEN
    RAISE EXCEPTION 'preflight: column already exists:%', existing_columns;
  END IF;

  RAISE NOTICE 'preflight passed: tables present, listed counts are 0, receipt columns absent';
END
$$;
