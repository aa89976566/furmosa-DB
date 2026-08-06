-- Preview RLS Phase 1 baseline (DRAFT — NOT auto-applied)
-- Target intent: Supabase Preview project_ref=etrcbqtibmkkjwlzdsng
-- FORBIDDEN: Production. FORBIDDEN: real passwords/secrets in this file.
--
-- Placeholders (must replace before any apply):
--   REPLACE_ME_FURMOSA_RUNTIME  = limited App runtime role (NOBYPASSRLS)
--   REPLACE_ME_SCHEMA_OWNER     = current table owner / migrate role (document only; not altered here)
--
-- Known Supabase platform roles (documented by Supabase, not guessed):
--   anon, authenticated, service_role
--
-- Phase 1 honesty:
--   * ENABLE RLS + revoke PostgREST anon/authenticated on business tables
--   * runtime role gets DML + permissive server policies (USING/CHECK true)
--   * Does NOT implement per-merchant/per-customer row filters yet
--   * Does NOT FORCE RLS (owner migrate path must keep working)
--   * Does NOT touch _prisma_migrations, auth schema, storage schema, realtime schema
--
-- Password for REPLACE_ME_FURMOSA_RUNTIME must be set out-of-band via secret manager
-- (ALTER ROLE ... with a password argument). Never commit that password.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Limited runtime role FIRST (no password here)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'REPLACE_ME_FURMOSA_RUNTIME') THEN
    CREATE ROLE "REPLACE_ME_FURMOSA_RUNTIME"
      NOINHERIT
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOBYPASSRLS
      LOGIN;
  END IF;
END
$$;

-- Ensure attributes even if role pre-existed with wrong flags
ALTER ROLE "REPLACE_ME_FURMOSA_RUNTIME" NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN;

GRANT USAGE ON SCHEMA public TO "REPLACE_ME_FURMOSA_RUNTIME";

-- ---------------------------------------------------------------------------
-- 1) Helper schema for Phase 2 claims (safe stubs; unused by Phase 1 policies)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app_rls;

CREATE OR REPLACE FUNCTION app_rls.current_actor_type()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.actor_type', true), '');
$$;

CREATE OR REPLACE FUNCTION app_rls.current_merchant_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.merchant_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_rls.current_customer_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.customer_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_rls.current_line_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.line_user_id', true), '');
$$;

REVOKE ALL ON SCHEMA app_rls FROM PUBLIC;
GRANT USAGE ON SCHEMA app_rls TO "REPLACE_ME_FURMOSA_RUNTIME";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_rls TO "REPLACE_ME_FURMOSA_RUNTIME";

-- Table User
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "User" FROM PUBLIC;
REVOKE ALL ON TABLE "User" FROM anon;
REVOKE ALL ON TABLE "User" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "User" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_User" ON "User";
CREATE POLICY "furmosa_p1_runtime_all_User" ON "User"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table user_push_subscriptions
ALTER TABLE "user_push_subscriptions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "user_push_subscriptions" FROM PUBLIC;
REVOKE ALL ON TABLE "user_push_subscriptions" FROM anon;
REVOKE ALL ON TABLE "user_push_subscriptions" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user_push_subscriptions" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_user_push_subscriptions" ON "user_push_subscriptions";
CREATE POLICY "furmosa_p1_runtime_all_user_push_subscriptions" ON "user_push_subscriptions"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Vendor
ALTER TABLE "Vendor" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Vendor" FROM PUBLIC;
REVOKE ALL ON TABLE "Vendor" FROM anon;
REVOKE ALL ON TABLE "Vendor" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Vendor" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Vendor" ON "Vendor";
CREATE POLICY "furmosa_p1_runtime_all_Vendor" ON "Vendor"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Customer
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Customer" FROM PUBLIC;
REVOKE ALL ON TABLE "Customer" FROM anon;
REVOKE ALL ON TABLE "Customer" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Customer" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Customer" ON "Customer";
CREATE POLICY "furmosa_p1_runtime_all_Customer" ON "Customer"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table LineChatSession
ALTER TABLE "LineChatSession" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "LineChatSession" FROM PUBLIC;
REVOKE ALL ON TABLE "LineChatSession" FROM anon;
REVOKE ALL ON TABLE "LineChatSession" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "LineChatSession" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_LineChatSession" ON "LineChatSession";
CREATE POLICY "furmosa_p1_runtime_all_LineChatSession" ON "LineChatSession"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table LineMenuState
ALTER TABLE "LineMenuState" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "LineMenuState" FROM PUBLIC;
REVOKE ALL ON TABLE "LineMenuState" FROM anon;
REVOKE ALL ON TABLE "LineMenuState" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "LineMenuState" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_LineMenuState" ON "LineMenuState";
CREATE POLICY "furmosa_p1_runtime_all_LineMenuState" ON "LineMenuState"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table customer_services
ALTER TABLE "customer_services" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "customer_services" FROM PUBLIC;
REVOKE ALL ON TABLE "customer_services" FROM anon;
REVOKE ALL ON TABLE "customer_services" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "customer_services" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_customer_services" ON "customer_services";
CREATE POLICY "furmosa_p1_runtime_all_customer_services" ON "customer_services"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table jar_codes
ALTER TABLE "jar_codes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "jar_codes" FROM PUBLIC;
REVOKE ALL ON TABLE "jar_codes" FROM anon;
REVOKE ALL ON TABLE "jar_codes" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "jar_codes" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_jar_codes" ON "jar_codes";
CREATE POLICY "furmosa_p1_runtime_all_jar_codes" ON "jar_codes"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table member_points_ledger
ALTER TABLE "member_points_ledger" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "member_points_ledger" FROM PUBLIC;
REVOKE ALL ON TABLE "member_points_ledger" FROM anon;
REVOKE ALL ON TABLE "member_points_ledger" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "member_points_ledger" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_member_points_ledger" ON "member_points_ledger";
CREATE POLICY "furmosa_p1_runtime_all_member_points_ledger" ON "member_points_ledger"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table refill_orders
ALTER TABLE "refill_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "refill_orders" FROM PUBLIC;
REVOKE ALL ON TABLE "refill_orders" FROM anon;
REVOKE ALL ON TABLE "refill_orders" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "refill_orders" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_refill_orders" ON "refill_orders";
CREATE POLICY "furmosa_p1_runtime_all_refill_orders" ON "refill_orders"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table payment_orders
ALTER TABLE "payment_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "payment_orders" FROM PUBLIC;
REVOKE ALL ON TABLE "payment_orders" FROM anon;
REVOKE ALL ON TABLE "payment_orders" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payment_orders" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_payment_orders" ON "payment_orders";
CREATE POLICY "furmosa_p1_runtime_all_payment_orders" ON "payment_orders"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table refill_audit_logs
ALTER TABLE "refill_audit_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "refill_audit_logs" FROM PUBLIC;
REVOKE ALL ON TABLE "refill_audit_logs" FROM anon;
REVOKE ALL ON TABLE "refill_audit_logs" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "refill_audit_logs" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_refill_audit_logs" ON "refill_audit_logs";
CREATE POLICY "furmosa_p1_runtime_all_refill_audit_logs" ON "refill_audit_logs"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table reward_catalog
ALTER TABLE "reward_catalog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "reward_catalog" FROM PUBLIC;
REVOKE ALL ON TABLE "reward_catalog" FROM anon;
REVOKE ALL ON TABLE "reward_catalog" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "reward_catalog" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_reward_catalog" ON "reward_catalog";
CREATE POLICY "furmosa_p1_runtime_all_reward_catalog" ON "reward_catalog"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table reward_redemptions
ALTER TABLE "reward_redemptions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "reward_redemptions" FROM PUBLIC;
REVOKE ALL ON TABLE "reward_redemptions" FROM anon;
REVOKE ALL ON TABLE "reward_redemptions" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "reward_redemptions" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_reward_redemptions" ON "reward_redemptions";
CREATE POLICY "furmosa_p1_runtime_all_reward_redemptions" ON "reward_redemptions"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table marketing_cost_records
ALTER TABLE "marketing_cost_records" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "marketing_cost_records" FROM PUBLIC;
REVOKE ALL ON TABLE "marketing_cost_records" FROM anon;
REVOKE ALL ON TABLE "marketing_cost_records" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "marketing_cost_records" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_marketing_cost_records" ON "marketing_cost_records";
CREATE POLICY "furmosa_p1_runtime_all_marketing_cost_records" ON "marketing_cost_records"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table stores
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "stores" FROM PUBLIC;
REVOKE ALL ON TABLE "stores" FROM anon;
REVOKE ALL ON TABLE "stores" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "stores" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_stores" ON "stores";
CREATE POLICY "furmosa_p1_runtime_all_stores" ON "stores"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table coupons
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "coupons" FROM PUBLIC;
REVOKE ALL ON TABLE "coupons" FROM anon;
REVOKE ALL ON TABLE "coupons" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "coupons" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_coupons" ON "coupons";
CREATE POLICY "furmosa_p1_runtime_all_coupons" ON "coupons"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Merchant
ALTER TABLE "Merchant" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Merchant" FROM PUBLIC;
REVOKE ALL ON TABLE "Merchant" FROM anon;
REVOKE ALL ON TABLE "Merchant" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Merchant" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Merchant" ON "Merchant";
CREATE POLICY "furmosa_p1_runtime_all_Merchant" ON "Merchant"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table merchant_settings
ALTER TABLE "merchant_settings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "merchant_settings" FROM PUBLIC;
REVOKE ALL ON TABLE "merchant_settings" FROM anon;
REVOKE ALL ON TABLE "merchant_settings" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "merchant_settings" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_merchant_settings" ON "merchant_settings";
CREATE POLICY "furmosa_p1_runtime_all_merchant_settings" ON "merchant_settings"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table appointments
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "appointments" FROM PUBLIC;
REVOKE ALL ON TABLE "appointments" FROM anon;
REVOKE ALL ON TABLE "appointments" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "appointments" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_appointments" ON "appointments";
CREATE POLICY "furmosa_p1_runtime_all_appointments" ON "appointments"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table merchant_users
ALTER TABLE "merchant_users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "merchant_users" FROM PUBLIC;
REVOKE ALL ON TABLE "merchant_users" FROM anon;
REVOKE ALL ON TABLE "merchant_users" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "merchant_users" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_merchant_users" ON "merchant_users";
CREATE POLICY "furmosa_p1_runtime_all_merchant_users" ON "merchant_users"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Warehouse
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Warehouse" FROM PUBLIC;
REVOKE ALL ON TABLE "Warehouse" FROM anon;
REVOKE ALL ON TABLE "Warehouse" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Warehouse" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Warehouse" ON "Warehouse";
CREATE POLICY "furmosa_p1_runtime_all_Warehouse" ON "Warehouse"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Product
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Product" FROM PUBLIC;
REVOKE ALL ON TABLE "Product" FROM anon;
REVOKE ALL ON TABLE "Product" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Product" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Product" ON "Product";
CREATE POLICY "furmosa_p1_runtime_all_Product" ON "Product"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table ProductPriceTier
ALTER TABLE "ProductPriceTier" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ProductPriceTier" FROM PUBLIC;
REVOKE ALL ON TABLE "ProductPriceTier" FROM anon;
REVOKE ALL ON TABLE "ProductPriceTier" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ProductPriceTier" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_ProductPriceTier" ON "ProductPriceTier";
CREATE POLICY "furmosa_p1_runtime_all_ProductPriceTier" ON "ProductPriceTier"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table MerchantProductRule
ALTER TABLE "MerchantProductRule" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MerchantProductRule" FROM PUBLIC;
REVOKE ALL ON TABLE "MerchantProductRule" FROM anon;
REVOKE ALL ON TABLE "MerchantProductRule" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MerchantProductRule" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_MerchantProductRule" ON "MerchantProductRule";
CREATE POLICY "furmosa_p1_runtime_all_MerchantProductRule" ON "MerchantProductRule"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Shipment
ALTER TABLE "Shipment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Shipment" FROM PUBLIC;
REVOKE ALL ON TABLE "Shipment" FROM anon;
REVOKE ALL ON TABLE "Shipment" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Shipment" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Shipment" ON "Shipment";
CREATE POLICY "furmosa_p1_runtime_all_Shipment" ON "Shipment"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table restock_requests
ALTER TABLE "restock_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "restock_requests" FROM PUBLIC;
REVOKE ALL ON TABLE "restock_requests" FROM anon;
REVOKE ALL ON TABLE "restock_requests" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "restock_requests" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_restock_requests" ON "restock_requests";
CREATE POLICY "furmosa_p1_runtime_all_restock_requests" ON "restock_requests"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table restock_request_items
ALTER TABLE "restock_request_items" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "restock_request_items" FROM PUBLIC;
REVOKE ALL ON TABLE "restock_request_items" FROM anon;
REVOKE ALL ON TABLE "restock_request_items" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "restock_request_items" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_restock_request_items" ON "restock_request_items";
CREATE POLICY "furmosa_p1_runtime_all_restock_request_items" ON "restock_request_items"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table ShipmentItem
ALTER TABLE "ShipmentItem" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ShipmentItem" FROM PUBLIC;
REVOKE ALL ON TABLE "ShipmentItem" FROM anon;
REVOKE ALL ON TABLE "ShipmentItem" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ShipmentItem" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_ShipmentItem" ON "ShipmentItem";
CREATE POLICY "furmosa_p1_runtime_all_ShipmentItem" ON "ShipmentItem"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table MerchantStock
ALTER TABLE "MerchantStock" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MerchantStock" FROM PUBLIC;
REVOKE ALL ON TABLE "MerchantStock" FROM anon;
REVOKE ALL ON TABLE "MerchantStock" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MerchantStock" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_MerchantStock" ON "MerchantStock";
CREATE POLICY "furmosa_p1_runtime_all_MerchantStock" ON "MerchantStock"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table MerchantStockTxn
ALTER TABLE "MerchantStockTxn" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MerchantStockTxn" FROM PUBLIC;
REVOKE ALL ON TABLE "MerchantStockTxn" FROM anon;
REVOKE ALL ON TABLE "MerchantStockTxn" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MerchantStockTxn" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_MerchantStockTxn" ON "MerchantStockTxn";
CREATE POLICY "furmosa_p1_runtime_all_MerchantStockTxn" ON "MerchantStockTxn"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table InventoryBalance
ALTER TABLE "InventoryBalance" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InventoryBalance" FROM PUBLIC;
REVOKE ALL ON TABLE "InventoryBalance" FROM anon;
REVOKE ALL ON TABLE "InventoryBalance" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "InventoryBalance" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_InventoryBalance" ON "InventoryBalance";
CREATE POLICY "furmosa_p1_runtime_all_InventoryBalance" ON "InventoryBalance"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table InventoryTransaction
ALTER TABLE "InventoryTransaction" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InventoryTransaction" FROM PUBLIC;
REVOKE ALL ON TABLE "InventoryTransaction" FROM anon;
REVOKE ALL ON TABLE "InventoryTransaction" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "InventoryTransaction" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_InventoryTransaction" ON "InventoryTransaction";
CREATE POLICY "furmosa_p1_runtime_all_InventoryTransaction" ON "InventoryTransaction"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Order
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Order" FROM PUBLIC;
REVOKE ALL ON TABLE "Order" FROM anon;
REVOKE ALL ON TABLE "Order" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Order" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Order" ON "Order";
CREATE POLICY "furmosa_p1_runtime_all_Order" ON "Order"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table OrderItem
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "OrderItem" FROM PUBLIC;
REVOKE ALL ON TABLE "OrderItem" FROM anon;
REVOKE ALL ON TABLE "OrderItem" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OrderItem" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_OrderItem" ON "OrderItem";
CREATE POLICY "furmosa_p1_runtime_all_OrderItem" ON "OrderItem"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Settlement
ALTER TABLE "Settlement" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Settlement" FROM PUBLIC;
REVOKE ALL ON TABLE "Settlement" FROM anon;
REVOKE ALL ON TABLE "Settlement" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Settlement" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Settlement" ON "Settlement";
CREATE POLICY "furmosa_p1_runtime_all_Settlement" ON "Settlement"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table SubscriptionPlan
ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SubscriptionPlan" FROM PUBLIC;
REVOKE ALL ON TABLE "SubscriptionPlan" FROM anon;
REVOKE ALL ON TABLE "SubscriptionPlan" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SubscriptionPlan" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_SubscriptionPlan" ON "SubscriptionPlan";
CREATE POLICY "furmosa_p1_runtime_all_SubscriptionPlan" ON "SubscriptionPlan"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Subscription
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Subscription" FROM PUBLIC;
REVOKE ALL ON TABLE "Subscription" FROM anon;
REVOKE ALL ON TABLE "Subscription" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Subscription" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Subscription" ON "Subscription";
CREATE POLICY "furmosa_p1_runtime_all_Subscription" ON "Subscription"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table SubscriptionShipment
ALTER TABLE "SubscriptionShipment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SubscriptionShipment" FROM PUBLIC;
REVOKE ALL ON TABLE "SubscriptionShipment" FROM anon;
REVOKE ALL ON TABLE "SubscriptionShipment" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "SubscriptionShipment" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_SubscriptionShipment" ON "SubscriptionShipment";
CREATE POLICY "furmosa_p1_runtime_all_SubscriptionShipment" ON "SubscriptionShipment"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table Task
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Task" FROM PUBLIC;
REVOKE ALL ON TABLE "Task" FROM anon;
REVOKE ALL ON TABLE "Task" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Task" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_Task" ON "Task";
CREATE POLICY "furmosa_p1_runtime_all_Task" ON "Task"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table DashboardKpiSnapshot
ALTER TABLE "DashboardKpiSnapshot" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DashboardKpiSnapshot" FROM PUBLIC;
REVOKE ALL ON TABLE "DashboardKpiSnapshot" FROM anon;
REVOKE ALL ON TABLE "DashboardKpiSnapshot" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "DashboardKpiSnapshot" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_DashboardKpiSnapshot" ON "DashboardKpiSnapshot";
CREATE POLICY "furmosa_p1_runtime_all_DashboardKpiSnapshot" ON "DashboardKpiSnapshot"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table campaigns
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "campaigns" FROM PUBLIC;
REVOKE ALL ON TABLE "campaigns" FROM anon;
REVOKE ALL ON TABLE "campaigns" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "campaigns" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_campaigns" ON "campaigns";
CREATE POLICY "furmosa_p1_runtime_all_campaigns" ON "campaigns"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table campaign_applications
ALTER TABLE "campaign_applications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "campaign_applications" FROM PUBLIC;
REVOKE ALL ON TABLE "campaign_applications" FROM anon;
REVOKE ALL ON TABLE "campaign_applications" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "campaign_applications" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_campaign_applications" ON "campaign_applications";
CREATE POLICY "furmosa_p1_runtime_all_campaign_applications" ON "campaign_applications"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table ConversationSession
ALTER TABLE "ConversationSession" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ConversationSession" FROM PUBLIC;
REVOKE ALL ON TABLE "ConversationSession" FROM anon;
REVOKE ALL ON TABLE "ConversationSession" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ConversationSession" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_ConversationSession" ON "ConversationSession";
CREATE POLICY "furmosa_p1_runtime_all_ConversationSession" ON "ConversationSession"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table conversation_messages
ALTER TABLE "conversation_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "conversation_messages" FROM PUBLIC;
REVOKE ALL ON TABLE "conversation_messages" FROM anon;
REVOKE ALL ON TABLE "conversation_messages" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "conversation_messages" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_conversation_messages" ON "conversation_messages";
CREATE POLICY "furmosa_p1_runtime_all_conversation_messages" ON "conversation_messages"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table order_reviews
ALTER TABLE "order_reviews" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "order_reviews" FROM PUBLIC;
REVOKE ALL ON TABLE "order_reviews" FROM anon;
REVOKE ALL ON TABLE "order_reviews" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "order_reviews" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_order_reviews" ON "order_reviews";
CREATE POLICY "furmosa_p1_runtime_all_order_reviews" ON "order_reviews"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table status_audit_logs
ALTER TABLE "status_audit_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "status_audit_logs" FROM PUBLIC;
REVOKE ALL ON TABLE "status_audit_logs" FROM anon;
REVOKE ALL ON TABLE "status_audit_logs" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "status_audit_logs" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_status_audit_logs" ON "status_audit_logs";
CREATE POLICY "furmosa_p1_runtime_all_status_audit_logs" ON "status_audit_logs"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table refill_flavours
ALTER TABLE "refill_flavours" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "refill_flavours" FROM PUBLIC;
REVOKE ALL ON TABLE "refill_flavours" FROM anon;
REVOKE ALL ON TABLE "refill_flavours" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "refill_flavours" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_refill_flavours" ON "refill_flavours";
CREATE POLICY "furmosa_p1_runtime_all_refill_flavours" ON "refill_flavours"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table merchant_refill_stocks
ALTER TABLE "merchant_refill_stocks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "merchant_refill_stocks" FROM PUBLIC;
REVOKE ALL ON TABLE "merchant_refill_stocks" FROM anon;
REVOKE ALL ON TABLE "merchant_refill_stocks" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "merchant_refill_stocks" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_merchant_refill_stocks" ON "merchant_refill_stocks";
CREATE POLICY "furmosa_p1_runtime_all_merchant_refill_stocks" ON "merchant_refill_stocks"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table refill_stock_txns
ALTER TABLE "refill_stock_txns" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "refill_stock_txns" FROM PUBLIC;
REVOKE ALL ON TABLE "refill_stock_txns" FROM anon;
REVOKE ALL ON TABLE "refill_stock_txns" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "refill_stock_txns" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_refill_stock_txns" ON "refill_stock_txns";
CREATE POLICY "furmosa_p1_runtime_all_refill_stock_txns" ON "refill_stock_txns"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);
-- Table refill_plan_settings
ALTER TABLE "refill_plan_settings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "refill_plan_settings" FROM PUBLIC;
REVOKE ALL ON TABLE "refill_plan_settings" FROM anon;
REVOKE ALL ON TABLE "refill_plan_settings" FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "refill_plan_settings" TO "REPLACE_ME_FURMOSA_RUNTIME";
DROP POLICY IF EXISTS "furmosa_p1_runtime_all_refill_plan_settings" ON "refill_plan_settings";
CREATE POLICY "furmosa_p1_runtime_all_refill_plan_settings" ON "refill_plan_settings"
  FOR ALL
  TO "REPLACE_ME_FURMOSA_RUNTIME"
  USING (true)
  WITH CHECK (true);

-- Sequences (cuid tables may not need; grant broadly for safety on public)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "REPLACE_ME_FURMOSA_RUNTIME";

-- Default privileges for future tables created by owner (best-effort; owner name unknown)
-- Document: after apply, run as schema owner if needed:
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "REPLACE_ME_FURMOSA_RUNTIME";

COMMIT;
