import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('Postgres ownership: bought stock never becomes consignment receivable', async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "MerchantStock" (id text primary key,"merchantId" text,"productId" text,"tierId" text,quantity int);
      CREATE TABLE "Order" (id text primary key,merchant_order_mode text);
      CREATE TABLE "Shipment" (id text primary key,"orderId" text,"merchantId" text);
      CREATE TABLE "ShipmentItem" (id text primary key,"shipmentId" text,"productId" text,"variantKey" text,"weightGrams" int);
      CREATE TABLE "MerchantStockTxn" (id text primary key,"shipmentItemId" text unique,"merchantId" text,"productId" text,
        type text,quantity int,"unitPrice" float8,"commissionAmount" float8,"companyRevenue" float8,
        "settlementId" text,note text,"createdAt" timestamp default now());
    `);
    await db.exec(readFileSync('prisma/migrations/20261106011423_merchant_inventory_ownership/migration.sql', 'utf8'));
    let seq = 0;
    async function setup(stock: number, bought: number, consigned = 0) {
      const id = `s${++seq}`;
      await db.query('INSERT INTO "MerchantStock" VALUES ($1,$1,$1,\'tier\',$2)', [id, stock]);
      if (bought) await db.query(`INSERT INTO "MerchantStockLot"(id,"stockId","sourceKey",mode,"initialQuantity","remainingQuantity","acquiredAt",gift)
        VALUES ($1,$2,$1,'wholesale',$3,$3,'2026-01-01',true)`, [`lot-${id}`, id, bought]);
      if (consigned) await db.query(`INSERT INTO "MerchantStockLot"(id,"stockId","sourceKey",mode,"initialQuantity","remainingQuantity","acquiredAt")
        VALUES ($1,$2,$1,'consignment',$3,$3,'2026-02-01')`, [`consign-${id}`, id, consigned]);
      return id;
    }
    async function movement(id: string, qty: number, type = 'sale', tier: string | null = 'tier') {
      const txn = `txn-${++seq}`;
      return db.transaction(async tx => {
        const stock = await tx.query<{quantity: number}>(`UPDATE "MerchantStock" SET quantity=quantity+$2 WHERE id=$1 AND quantity+$2>=0 RETURNING quantity`, [id, qty]);
        if (!stock.rows.length) throw new Error('insufficient stock');
        const result = await tx.query<Record<string, unknown>>(`INSERT INTO "MerchantStockTxn"
          (id,"merchantId","productId","tierId",type,quantity,"unitPrice","commissionAmount","companyRevenue")
          VALUES ($1,$2,$2,$3,$4,$5::integer,165,33*abs($5::integer),132*abs($5::integer)) RETURNING *`, [txn,id,tier,type,qty]);
        return result.rows[0]!;
      });
    }
    await t.test('20 buyout: sell 1, stock 19, gross 165, monthly receivable 0', async () => {
      const id=await setup(20,20); const row=await movement(id,-1);
      assert.equal(row.settlementQuantity,0); assert.equal(row.companyRevenue,0); assert.equal(row.commissionAmount,0);
      assert.equal(row.commercialMode,'wholesale'); assert.equal(row.unitPrice,165);
      assert.equal((await db.query<{quantity:number}>('SELECT quantity FROM "MerchantStock" WHERE id=$1',[id])).rows[0]!.quantity,19);
      assert.equal((await db.query<{remainingQuantity:number}>('SELECT "remainingQuantity" FROM "MerchantStockLot" WHERE "stockId"=$1',[id])).rows[0]!.remainingQuantity,19);
      await db.transaction(async tx => {
        await tx.query('UPDATE "MerchantStock" SET quantity=quantity+1 WHERE id=$1',[id]);
        await tx.query('DELETE FROM "MerchantStockTxn" WHERE id=$1',[row.id]);
      });
      assert.equal((await db.query<{remainingQuantity:number}>('SELECT "remainingQuantity" FROM "MerchantStockLot" WHERE "stockId"=$1',[id])).rows[0]!.remainingQuantity,20);
    });
    await t.test('mixed FIFO sale bills only the consigned unit',async()=>{
      const row=await movement(await setup(5,3,2),-4);
      assert.equal(row.settlementQuantity,1); assert.equal(row.companyRevenue,132); assert.equal(row.commissionAmount,33);
      assert.equal(row.commercialMode,'mixed'); assert.equal((row.inventoryAllocation as unknown[]).length,2);
      await assert.rejects(db.query('UPDATE "MerchantStockTxn" SET quantity=-2 WHERE id=$1',[row.id]),/immutable/);
      await db.query('UPDATE "MerchantStockTxn" SET "settlementId"=\'settled\' WHERE id=$1',[row.id]);
      await assert.rejects(db.query('DELETE FROM "MerchantStockTxn" WHERE id=$1',[row.id]),/cannot be undone/);
    });
    await t.test('legacy stock keeps its existing pricing and missing-tier compatibility',async()=>{
      const row=await movement(await setup(3,0),-2,'sale',null);
      assert.equal(row.settlementQuantity,null); assert.equal(row.companyRevenue,264);
    });
    await t.test('count differences on tracked stock are zero-money movements',async()=>{
      const row=await movement(await setup(4,4),-2,'adjust');
      assert.equal(row.settlementQuantity,0); assert.equal(row.unitPrice,0); assert.equal(row.companyRevenue,0);
    });
    await t.test('missing tier or inconsistent ownership rolls back the stock change',async()=>{
      const id=await setup(4,4);
      await assert.rejects(movement(id,-1,'sale',null),/explicit tier/);
      assert.equal((await db.query<{quantity:number}>('SELECT quantity FROM "MerchantStock" WHERE id=$1',[id])).rows[0]!.quantity,4);
      const broken=await setup(4,3);
      await assert.rejects(movement(broken,-1),/differs from stock/);
      await assert.rejects(movement(id,-5),/insufficient stock/);
    });
    await t.test('wholesale receipt creates bought batch and preserves prior legacy consignment',async()=>{
      const id=await setup(3,0);
      await db.query('INSERT INTO "Order" VALUES ($1,\'wholesale\')',[id]);
      await db.query('INSERT INTO "Shipment" VALUES ($1,$1,$1)',[id]);
      await db.query('INSERT INTO "ShipmentItem" VALUES ($1,$1,$1,\'tier\',30)',[id]);
      async function receive(){return db.transaction(async tx=>{
        await tx.query('UPDATE "MerchantStock" SET quantity=quantity+2 WHERE id=$1',[id]);
        await tx.query(`INSERT INTO "MerchantStockTxn"(id,"shipmentItemId","merchantId","productId","tierId",type,quantity)
          VALUES ($1,$2,$2,$2,'tier','restock',2)`,['receipt-'+id,id]);
      });}
      await receive();
      const lots=await db.query<{mode:string;remainingQuantity:number}>('SELECT mode,"remainingQuantity" FROM "MerchantStockLot" WHERE "stockId"=$1 ORDER BY "acquiredAt"',[id]);
      assert.deepEqual(lots.rows,[{mode:'consignment',remainingQuantity:3},{mode:'wholesale',remainingQuantity:2}]);
      await assert.rejects(receive(),/duplicate key/);
      assert.equal((await db.query<{quantity:number}>('SELECT quantity FROM "MerchantStock" WHERE id=$1',[id])).rows[0]!.quantity,5);
    });
  } finally { await db.close(); }
});
