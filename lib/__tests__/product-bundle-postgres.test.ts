import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('Postgres bundle inventory uses ingredient grams and immutable posting snapshots', async t => {
 const db = new PGlite();
 try {
  await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated;
   CREATE TABLE "Warehouse"(id text primary key,code text);
   CREATE TABLE "Product"(id text primary key,sku text,unit text,category text,product_category text,status text,inventory_source_product_id text);
   CREATE TABLE "ProductPriceTier"(id text primary key,"productId" text,"weightGrams" int,unit text,"unitQty" int);
   CREATE TABLE "InventoryBalance"(id text primary key,"productId" text,"warehouseId" text,quantity int,unit text,"countNote" text,"updatedAt" timestamp);
   CREATE TABLE "InventoryTransaction"(id text primary key,"txnNumber" text,type text,"productId" text,"warehouseId" text,quantity int,reference text,note text,unit text,"eventKey" text unique,"reversesId" text unique);
   CREATE TABLE "ShipmentItem"(id text,"productId" text,quantity int,"weightGrams" int,unit text,"variantKey" text,"shipmentId" text);
   CREATE TABLE "OrderItem"(id text,"productId" text,quantity int,"weightGrams" int,unit text,"variantKey" text,"orderId" text);
   CREATE FUNCTION hq_bulk_unit(p_unit TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN p_unit IN ('g','克','公克') THEN 'g' WHEN p_unit IN ('隻','片','顆','條') THEN p_unit ELSE NULL END $$;
   INSERT INTO "Warehouse" VALUES ('wh','WH-MAIN');
   INSERT INTO "Product" VALUES ('bundle','BUNDLE','g','treats','STANDARD','active',null),('a','A','g','treats','STANDARD','draft',null),('b','B','g','treats','STANDARD','draft',null),('c','C','g','treats','STANDARD','draft',null),('salmon','SALMON','g','treats','STANDARD','active',null);
   INSERT INTO "ProductPriceTier" VALUES ('45','bundle',45,'g',1),('50','salmon',50,'g',1);
   INSERT INTO "InventoryBalance"(id,"productId","warehouseId",quantity,unit) VALUES ('a','a','wh',100,'g'),('b','b','wh',100,'g'),('c','c','wh',100,'g'),('bundle','bundle','wh',0,'g'),('salmon','salmon','wh',100,'g');
  `);
  await db.exec(readFileSync('prisma/migrations/20261106030000_product_bundle_components/migration.sql','utf8'));
  await db.exec(`INSERT INTO "ProductBundleComponent" VALUES ('45','a',15),('45','b',15),('45','c',15)`);
  const balances = async () => (await db.query<{productId:string;quantity:number}>(`SELECT "productId",quantity FROM "InventoryBalance" ORDER BY "productId"`)).rows;
  await t.test('configuration alone keeps all ingredients at 100g and finished stock at zero',async()=>{
   assert.deepEqual((await balances()).map(r=>r.quantity),[100,100,0,100,100]);
   assert.equal((await db.query('SELECT * FROM "InventoryTransaction"')).rows.length,0);
  });
  await t.test('ship 1: each ingredient 85g; retry unchanged; never subtract finished weight',async()=>{
   await db.exec(`INSERT INTO "ShipmentItem" VALUES ('l1','bundle',1,45,'g','45','s1'); SELECT hq_bulk_post('shipment','s1',false); SELECT hq_bulk_post('shipment','s1',false);`);
   assert.deepEqual((await balances()).map(r=>r.quantity),[85,85,0,85,100]);
   assert.equal((await db.query('SELECT * FROM "InventoryTransaction"')).rows.length,3);
  });
  await t.test('cancel uses recorded grams even after recipe changes; retry restores once',async()=>{
   await db.exec(`UPDATE "ProductBundleComponent" SET "gramsPerPack"=14 WHERE "componentProductId"='a'; SELECT hq_bulk_post('shipment','s1',true); SELECT hq_bulk_post('shipment','s1',true);`);
   assert.deepEqual((await balances()).map(r=>r.quantity),[100,100,0,100,100]);
   await assert.rejects(db.query(`SELECT hq_bulk_post('shipment','s1',false)`),/已回補/);
  });
  await t.test('invalid total and wrong component unit leave no partial deduction',async()=>{
   await db.exec(`INSERT INTO "ShipmentItem" VALUES ('l2','bundle',2,45,'g','45','s2');`);
   await assert.rejects(db.query(`SELECT hq_bulk_post('shipment','s2',false)`),/重量/);
   await db.exec(`UPDATE "ProductBundleComponent" SET "gramsPerPack"=15 WHERE "componentProductId"='a'; UPDATE "InventoryBalance" SET unit='包' WHERE "productId"='c';`);
   await assert.rejects(db.query(`SELECT hq_bulk_post('shipment','s2',false)`),/盤點/);
   assert.deepEqual((await balances()).map(r=>r.quantity),[100,100,0,100,100]);
   await db.exec(`UPDATE "InventoryBalance" SET unit='g' WHERE "productId"='c'`);
  });
  await t.test('ship 2 through order path consumes 30g each; salmon consumes its own 50g',async()=>{
   await db.exec(`INSERT INTO "OrderItem" VALUES ('o1','bundle',2,45,'g','45','order1'),('o2','salmon',1,50,'g','50','order1'); SELECT hq_bulk_post('order','order1',false);`);
   assert.deepEqual((await balances()).map(r=>r.quantity),[70,70,0,70,50]);
   await db.exec(`SELECT hq_bulk_post('order','order1',true)`);
   assert.deepEqual((await balances()).map(r=>r.quantity),[100,100,0,100,100]);
  });
  await t.test('reject nonpositive recipe and nested bundles',async()=>{
   await assert.rejects(db.exec(`UPDATE "ProductBundleComponent" SET "gramsPerPack"=0`),/check constraint/);
   await db.exec(`INSERT INTO "ProductPriceTier" VALUES ('nested','a',15,'g',1); INSERT INTO "ProductBundleComponent" VALUES ('nested','b',15);`);
   await assert.rejects(db.query(`SELECT hq_bulk_post('shipment','s2',false)`),/來源無效/);
  });
 } finally { await db.close(); }
});
