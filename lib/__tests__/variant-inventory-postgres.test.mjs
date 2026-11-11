
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
const setupSql=`
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE TABLE "Warehouse"(id text primary key,code text);
 CREATE TABLE "Product"(id text primary key,sku text,unit text,category text,product_category text,status text,inventory_source_product_id text,cost float default 0);
 CREATE TABLE "ProductPriceTier"(id text primary key,"productId" text,"weightGrams" int,unit text,"unitQty" int,cost float,variant_name text,shopify_variant_id text,notes text,shopify_sku text,price float default 399,status text default 'active');
 CREATE TABLE "InventoryBalance"(id text primary key,"productId" text,"warehouseId" text,quantity int,unit text,"countNote" text,"updatedAt" timestamp);
 CREATE TABLE "InventoryTransaction"(id text primary key,"txnNumber" text,type text,"productId" text,"warehouseId" text,quantity int,reference text,note text,unit text,"eventKey" text unique,"reversesId" text unique);
 CREATE TABLE "Shipment"(id text primary key,"orderId" text,"createdAt" timestamp default now(),status text default 'pending',"hqInventoryEligible" boolean default true);
 CREATE TABLE "Order"(id text primary key,"createdAt" timestamp default now(),status text default 'pending',"hqInventoryEligible" boolean default true,"fulfillmentStatus" text default 'pending',"paymentStatus" text default 'unpaid',oms_status text,oms_reviewed_at timestamp,oms_reviewed_by_id text,deleted_at timestamp,oms_checked_at timestamp,shopify_source_updated_at timestamp,oms_checked_source_updated_at timestamp,oms_issue_flags jsonb);
 CREATE TABLE "ShipmentItem"(id text,"productId" text,quantity int,"weightGrams" int,unit text,"variantKey" text,"shipmentId" text);
 CREATE TABLE "OrderItem"(id text,"productId" text,quantity int,"weightGrams" int,unit text,"variantKey" text,"orderId" text);
 CREATE FUNCTION hq_bulk_unit(p_unit TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN p_unit IN ('g','克','公克') THEN 'g' WHEN p_unit IN ('隻','片','顆','條') THEN p_unit ELSE NULL END $$;
 INSERT INTO "Warehouse" VALUES ('wh','WH-MAIN');
 INSERT INTO "Product"(id,sku,unit,category,product_category,status,inventory_source_product_id) VALUES ('collab','COLLAB','組','other','STANDARD','draft',null),('chicken','FUR-0002','g','treats','STANDARD','active',null),('fish','FISH','g','treats','STANDARD','active',null);
 INSERT INTO "ProductPriceTier"(id,"productId","weightGrams",unit,"unitQty",cost,variant_name) VALUES
 ('peony','collab',null,'組',1,230,'牡丹'),('doson','collab',null,'組',1,230,'杜桑'),('dior','collab',null,'組',1,230,'經典迪奧'),('lavender','collab',null,'組',1,230,'琥珀與薰衣草'),('chicken50','chicken',50,'g',1,40,null),('fish50','fish',50,'g',1,50,null);
 INSERT INTO "InventoryBalance"(id,"productId","warehouseId",quantity,unit) VALUES ('c','chicken','wh',100,'g'),('f','fish','wh',100,'g');
 `;

test('variant inventory: isolated scents, ledger snapshots and legacy compatibility',async t=>{
 const db=new PGlite();
 try{
 await db.exec(setupSql);
 await db.exec(readFileSync('prisma/migrations/20261106030000_product_bundle_components/migration.sql','utf8'));
 await db.exec(readFileSync('prisma/migrations/20261111200004_variant_inventory/migration.sql','utf8'));
 await db.exec(`UPDATE "ProductPriceTier" SET inventory_policy='variant',inventory_unit='顆',inventory_enabled_at='2026-11-11' WHERE "productId"='collab';
 INSERT INTO "ProductVariantInventoryBalance"("tierId","warehouseId",quantity,unit) SELECT id,'wh',20,'顆' FROM "ProductPriceTier" WHERE "productId"='collab';`);
 const qty=async()=>Object.fromEntries((await db.query('SELECT "tierId",quantity FROM "ProductVariantInventoryBalance"')).rows.map(r=>[r.tierId,r.quantity]));
 const make=async(id,sc='peony',q=1,date='2026-11-12')=>{
 await db.query('INSERT INTO "Shipment"(id,"createdAt") VALUES ($1,$2)',[id,date]);
 await db.query('INSERT INTO "ShipmentItem" VALUES ($1,\'collab\',$2,null,\'組\',$3,$1)',[id,q,sc]);
 };
 await t.test('four independently initialized scents; nothing posted yet',async()=>{
 assert.deepEqual(await qty(),{peony:20,doson:20,dior:20,lavender:20});
 assert.equal((await db.query('SELECT * FROM "ProductVariantInventoryTransaction"')).rows.length,0);
 });
 await t.test('one peony and retry only deduct peony once',async()=>{
 await make('s1');await db.exec("SELECT hq_bulk_post('shipment','s1',false);SELECT hq_bulk_post('shipment','s1',false)");
 assert.deepEqual(await qty(),{peony:19,doson:20,dior:20,lavender:20});
 const snapshot=(await db.query('SELECT "sourceSnapshot" FROM "ProductVariantInventoryTransaction"')).rows[0].sourceSnapshot;
 assert.equal(snapshot.variantName,'牡丹');assert.equal(snapshot.unitCost,230);
 });
 await t.test('cancel uses snapshot even after cost, name and policy change',async()=>{
 await db.exec("UPDATE \"ProductPriceTier\" SET cost=999,variant_name='changed',inventory_policy='shared' WHERE id='peony'; SELECT hq_bulk_post('shipment','s1',true);SELECT hq_bulk_post('shipment','s1',true)");
 assert.equal((await qty()).peony,20);
 const r=(await db.query("SELECT * FROM \"ProductVariantInventoryTransaction\" WHERE type='return_in'")).rows[0];assert.equal(r.sourceSnapshot.unitCost,230);
 await assert.rejects(db.exec("SELECT hq_bulk_post('shipment','s1',false)"),/已回補/);
 await db.exec("UPDATE \"ProductPriceTier\" SET inventory_policy='variant',cost=230 WHERE id='peony'");
 });
 await t.test('invalid or missing scent rolls back the whole source',async()=>{
 await make('bad','doson',2);await db.exec("INSERT INTO \"ShipmentItem\" VALUES ('bad2','collab',1,null,'組',null,'bad')");
 await assert.rejects(db.exec("SELECT hq_bulk_post('shipment','bad',false)"),/唯一有效/);assert.equal((await qty()).doson,20);
 });
 await t.test('old orders and old-order new shipments do not backfill',async()=>{
 await make('old','doson',1,'2026-11-10');await db.exec("SELECT hq_bulk_post('shipment','old',false)");
 await db.exec("INSERT INTO \"Order\"(id,\"createdAt\") VALUES ('old-order','2026-11-10')");
 await make('new-shipment');await db.exec("UPDATE \"Shipment\" SET \"orderId\"='old-order' WHERE id='new-shipment';SELECT hq_bulk_post('shipment','new-shipment',false)");
 assert.deepEqual(await qty(),{peony:20,doson:20,dior:20,lavender:20});
 });
 await t.test('mixed shipment keeps legacy fish deduction and made-to-order chicken exemption',async()=>{
 await make('mixed','lavender',2);
 await db.exec("INSERT INTO \"ShipmentItem\" VALUES ('fish-line','fish',1,50,'g','fish50','mixed'),('chicken-line','chicken',1,50,'g','chicken50','mixed'); SELECT hq_bulk_post('shipment','mixed',false);SELECT hq_bulk_post('shipment','mixed',false)");
 assert.equal((await qty()).lavender,18);
 const shared=(await db.query('SELECT "productId",quantity FROM "InventoryBalance" ORDER BY "productId"')).rows;assert.deepEqual(shared.map(r=>r.quantity),[100,50]);
 await db.exec("SELECT hq_bulk_post('shipment','mixed',true)");assert.equal((await qty()).lavender,20);
 });
 await t.test('order posting also preserves scent and blocks ledger mutation',async()=>{
 await db.exec("INSERT INTO \"Order\"(id,\"createdAt\") VALUES ('new-order','2026-11-12');INSERT INTO \"OrderItem\" VALUES ('o-line','collab',3,null,'組','dior','new-order');SELECT hq_bulk_post('order','new-order',false)");
 assert.equal((await qty()).dior,17);
 await assert.rejects(db.exec('DELETE FROM "ProductVariantInventoryTransaction"'),/不可改寫/);
 await db.exec("SELECT hq_bulk_post('order','new-order',true)");assert.equal((await qty()).dior,20);
 });
 await t.test('OMS gate, direct-order shipment guard, and posted line protection',async()=>{
 await db.exec(`INSERT INTO "Order"(id,"createdAt",status,oms_status) VALUES ('gated','2026-11-12','shipped','NEW');
 INSERT INTO "OrderItem" VALUES ('gated-line','collab',1,null,'組','peony','gated');`);
 await assert.rejects(db.exec("SELECT hq_bulk_sync_order('gated')"),/人工審核/);
 assert.equal((await qty()).peony,20);
 await db.exec(`UPDATE "Order" SET oms_status='READY',oms_reviewed_at=now(),oms_reviewed_by_id='reviewer',oms_checked_at=now(),shopify_source_updated_at=now(),oms_checked_source_updated_at=now(),oms_issue_flags='[]' WHERE id='gated';SELECT hq_bulk_sync_order('gated');SELECT hq_bulk_sync_order('gated');`);
 assert.equal((await qty()).peony,19);
 await db.exec(`INSERT INTO "Shipment"(id,"orderId",status,"createdAt") VALUES ('duplicate','gated','shipped','2026-11-12');`);
 await assert.rejects(db.exec("SELECT hq_bulk_sync_shipment('duplicate')"),/不可再/);
 await db.exec(`CREATE TRIGGER variant_test_protect BEFORE INSERT OR UPDATE OR DELETE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION hq_bulk_protect_lines();
 CREATE TRIGGER variant_test_shipment_protect BEFORE INSERT OR UPDATE OR DELETE ON "ShipmentItem" FOR EACH ROW EXECUTE FUNCTION hq_bulk_protect_lines();
 INSERT INTO "OrderItem" VALUES ('fresh-order-line','collab',1,null,'組','peony','fresh-order');
 INSERT INTO "ShipmentItem" VALUES ('fresh-shipment-line','collab',1,null,'組','peony','fresh-shipment');
 UPDATE "OrderItem" SET quantity=2 WHERE id='fresh-order-line';
 UPDATE "ShipmentItem" SET quantity=2 WHERE id='fresh-shipment-line';`);
 await assert.rejects(db.exec(`UPDATE "OrderItem" SET quantity=2 WHERE id='gated-line'`),/不可改寫/);
 await assert.rejects(db.exec(`DELETE FROM "OrderItem" WHERE id='gated-line'`),/不可改寫/);
 await assert.rejects(db.exec(`INSERT INTO "OrderItem" VALUES ('extra','collab',1,null,'組','peony','gated')`),/不可改寫/);
 await db.exec(`DROP TRIGGER variant_test_protect ON "OrderItem";DROP TRIGGER variant_test_shipment_protect ON "ShipmentItem";SELECT hq_bulk_post('order','gated',true);`);
 assert.equal((await qty()).peony,20);
 });
 await t.test('invalid units and missing opening balances fail closed; no legacy balance created for collab',async()=>{
 await assert.rejects(db.exec("UPDATE \"ProductPriceTier\" SET inventory_unit=null WHERE id='doson'"),/check constraint/);
 await db.exec("DELETE FROM \"ProductVariantInventoryBalance\" WHERE \"tierId\"='doson'");await make('no-balance','doson');
 await assert.rejects(db.exec("SELECT hq_bulk_post('shipment','no-balance',false)"),/正確單位/);
 assert.equal((await db.query("SELECT * FROM \"InventoryBalance\" WHERE \"productId\"='collab'")).rows.length,0);
 });
 }finally{await db.close()}
});


test('authorized opening is idempotent and never resets later sales',async()=>{
 const db=new PGlite();
 try{
 await db.exec(setupSql);
 await db.exec(readFileSync('prisma/migrations/20261106030000_product_bundle_components/migration.sql','utf8'));
 await db.exec(readFileSync('prisma/migrations/20261111200004_variant_inventory/migration.sql','utf8'));
 await db.exec(`
 UPDATE "Product" SET id='809871bc-c7b9-448a-8c27-73cb8e801fd0',sku='BUNDLE-WAX-2026',cost=230 WHERE id='collab';
 UPDATE "ProductPriceTier" SET "productId"='809871bc-c7b9-448a-8c27-73cb8e801fd0' WHERE "productId"='collab';
 UPDATE "ProductPriceTier" SET "productId"='cmp2idsu60006qw9lwk1thk62',id='cmpo2s6r6001hoseb1o5evkd8' WHERE id='chicken50';
 UPDATE "ProductPriceTier" SET shopify_sku='BUNDLE-WAX-2026-01',shopify_variant_id='65200876290425' WHERE id='peony';
 UPDATE "ProductPriceTier" SET shopify_sku='BUNDLE-WAX-2026-02',shopify_variant_id='65200876323193' WHERE id='doson';
 UPDATE "ProductPriceTier" SET shopify_sku='BUNDLE-WAX-2026-03',shopify_variant_id='65200876355961' WHERE id='dior';
 UPDATE "ProductPriceTier" SET shopify_sku='BUNDLE-WAX-2026-04',shopify_variant_id='65200876388729' WHERE id='lavender';
 `);
 const init=readFileSync('scripts/ops/initialize-collab-wax-variants.sql','utf8');
 await db.exec(init);await db.exec(init);
 assert.deepEqual((await db.query('SELECT quantity FROM "ProductVariantInventoryBalance"')).rows.map(r=>r.quantity),[20,20,20,20]);
 assert.equal((await db.query('SELECT * FROM "ProductVariantInventoryTransaction"')).rows.length,4);
 await db.exec(`INSERT INTO "Shipment"(id,"createdAt") VALUES ('after-opening',now()+interval '1 minute');
 INSERT INTO "ShipmentItem" VALUES ('after-line','809871bc-c7b9-448a-8c27-73cb8e801fd0',1,null,'組','peony','after-opening');
 SELECT hq_bulk_post('shipment','after-opening',false);`);
 await db.exec(init);
 assert.equal((await db.query('SELECT quantity FROM "ProductVariantInventoryBalance" WHERE "tierId"=\'peony\'')).rows[0].quantity,19);
 await db.exec("SET ROLE anon");
 await assert.rejects(db.exec('SELECT * FROM "ProductVariantInventoryBalance"'),/permission denied/);
 await assert.rejects(db.exec("SELECT hq_variant_post('shipment','after-opening',false)"),/permission denied/);
 await db.exec("RESET ROLE");
 }finally{await db.close()}
});
