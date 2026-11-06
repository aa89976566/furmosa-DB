-- These tables are accessed by the HQ/POS server through Prisma only.
-- Block direct PostgREST access from Supabase API roles while preserving
-- the database connection used by the application server.
-- Some legacy-only tables may not exist in every Preview/Test database.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'merchant_notifications',
    'merchant_notification_reads',
    'store_settlement_items',
    'merchant_balance_entries',
    'automation_jobs',
    'purchase_receipts',
    'purchase_receipt_items',
    'purchase_receipt_attachments',
    'purchase_orders',
    'purchase_order_items',
    'purchase_order_attachments',
    'stocktake_adjustments',
    'merchant_commercial_modules',
    'partner_applications',
    'task_attachments',
    'shopify_catalog_candidates',
    'vendor_settlements',
    'vendor_settlement_items'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
    END IF;
  END LOOP;
END
$$;
