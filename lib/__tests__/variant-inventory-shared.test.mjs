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


test('shared source: single candles and combos use one immutable scent pool',async t=>{
 const db=new PGlite();
 try{
 await db.exec(setupSql);
 for(const path of ['20261106030000_product_bundle_components','20261111200004_variant_inventory','20261117150000_variant_inventory_shared_source'])
  await db.exec(readFileSync(`prisma/migrations/${path}/migration.sql`,'utf8'));
 await db.exec(`UPDATE "ProductPriceTier" SET inventory_policy='variant',inventory_unit='顆',inventory_enabled_at='2026-11-11' WHERE "productId"='collab';
 INSERT INTO "ProductVariantInventoryBalance"("tierId","warehouseId",quantity,unit) SELECT id,'wh',20,'顆' FROM "ProductPriceTier" WHERE "productId"='collab';
 INSERT INTO "Product"(id,sku,unit,category,product_category,status) VALUES ('solo','TUNG-WAX','顆','other','STANDARD','active');
 INSERT INTO "ProductPriceTier"(id,"productId",unit,"unitQty",cost,price,variant_name,inventory_policy,inventory_unit,inventory_enabled_at,inventory_source_tier_id)
 SELECT 'solo-'||id,'solo','顆',1,190,250,variant_name,'variant','顆','2026-11-17',id FROM "ProductPriceTier" WHERE "productId"='collab';`);
 const qty=async()=>Object.fromEntries((await db.query('SELECT "tierId",quantity FROM "ProductVariantInventoryBalance"')).rows.map(r=>[r.tierId,r.quantity]));
 const line=async(id,product,tier,q=1,date='2026-11-18')=>{
 await db.query('INSERT INTO "Order"(id,"createdAt") VALUES ($1,$2)',[id,date]);
 await db.query(`INSERT INTO "OrderItem" VALUES ($1,$2,$3,null,'顆',$4,$1)`,[id,product,q,tier]);
 };
 await t.test('both selling paths, retries, different scents and prices retain one pool',async()=>{
 await line('solo-sale','solo','solo-peony',2);await line('combo-sale','collab','peony');await line('other','solo','solo-doson');
 await db.exec("SELECT hq_bulk_post('order','solo-sale',false);SELECT hq_bulk_post('order','combo-sale',false);SELECT hq_bulk_post('order','other',false);SELECT hq_bulk_post('order','solo-sale',false)");
 assert.deepEqual(await qty(),{peony:17,doson:19,dior:20,lavender:20});
 const rows=(await db.query(`SELECT "tierId","sourceSnapshot" FROM "ProductVariantInventoryTransaction" WHERE "tierId"='peony' ORDER BY quantity`)).rows;
 assert.deepEqual(rows.map(r=>r.tierId),['peony','peony']);
 assert.deepEqual(rows.map(r=>r.sourceSnapshot.unitCost),[190,230]);
 assert.equal(rows[0].sourceSnapshot.tierId,'solo-peony');assert.equal(rows[0].sourceSnapshot.stockTierId,'peony');
 });
 await t.test('cancel follows original pool even after alias changes and only returns once',async()=>{
 await db.exec(`UPDATE "ProductPriceTier" SET inventory_source_tier_id='dior',cost=999 WHERE id='solo-peony';
 SELECT hq_bulk_post('order','solo-sale',true);SELECT hq_bulk_post('order','solo-sale',true);`);
 assert.deepEqual(await qty(),{peony:19,doson:19,dior:20,lavender:20});
 const snap=(await db.query(`SELECT "sourceSnapshot" FROM "ProductVariantInventoryTransaction" WHERE type='return_in'`)).rows[0].sourceSnapshot;
 assert.equal(snap.unitCost,190);assert.equal(snap.stockTierId,'peony');
 await assert.rejects(db.exec("SELECT hq_bulk_post('order','solo-sale',false)"),/已回補/);
 });
 await t.test('chains, self links, unit conflicts and duplicate balances fail closed',async()=>{
 await assert.rejects(db.exec(`UPDATE "ProductPriceTier" SET inventory_source_tier_id='solo-doson' WHERE id='solo-dior'`),/共用庫存/);
 await assert.rejects(db.exec(`UPDATE "ProductPriceTier" SET inventory_source_tier_id='peony' WHERE id='peony'`),/共用庫存|check constraint/);
 await assert.rejects(db.exec(`UPDATE "ProductPriceTier" SET inventory_unit='組' WHERE id='doson'`),/已有共用商品/);
 await assert.rejects(db.exec(`INSERT INTO "ProductVariantInventoryBalance"("tierId","warehouseId",quantity,unit) VALUES ('solo-doson','wh',20,'顆')`),/不可另建/);
 await assert.rejects(db.exec(`UPDATE "ProductPriceTier" SET inventory_source_tier_id='dior' WHERE id='peony'`),/共用庫存/);
 assert.equal(Object.keys(await qty()).length,4);
 });
 await t.test('old orders never backfill and missing root balances cannot create stock',async()=>{
 await line('old-solo','solo','solo-dior',1,'2026-11-16');await db.exec("SELECT hq_bulk_post('order','old-solo',false)");
 assert.equal((await qty()).dior,20);
 await db.exec(`DELETE FROM "ProductVariantInventoryBalance" WHERE "tierId"='lavender'`);
 await line('missing','solo','solo-lavender');await assert.rejects(db.exec("SELECT hq_bulk_post('order','missing',false)"),/正確單位/);
 assert.equal((await db.query(`SELECT * FROM "ProductVariantInventoryBalance" WHERE "tierId" LIKE 'solo-%'`)).rows.length,0);
 });
 }finally{await db.close()}
});
