import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { bulkConsumption } from '../inventory/bulk';
import { createPrismaShopifyStore } from '../shopify/webhook-store';
import { syncShopifyCancellation } from '../shopify/shipment-events';

test('bulk units use master tiers, reject missing or ambiguous identity', () => {
 const p = {unit:'克',priceTiers:[{id:'a',weightGrams:30,unit:'g',unitQty:1},{id:'b',weightGrams:50,unit:'g',unitQty:1}]};
 assert.equal(bulkConsumption(p,{quantity:1,weightGrams:30}),30);
 assert.equal(bulkConsumption(p,{quantity:2,weightGrams:50}),100);
 assert.throws(()=>bulkConsumption(p,{quantity:1}));
 const q={unit:'隻',priceTiers:[{id:'one',weightGrams:null,unit:'隻',unitQty:1},{id:'three',weightGrams:null,unit:'隻',unitQty:3}]};
 assert.equal(bulkConsumption(q,{quantity:1,variantKey:'three'}),3);
 assert.throws(()=>bulkConsumption(q,{quantity:1}));
});
const local = /@(localhost|127\.0\.0\.1):\d+\/(ci|hq_bulk_test)(\?|$)/.test(process.env.DATABASE_URL ?? '');
test('HQ ledger is atomic, idempotent, reversible, isolated from POS and historical shipments', {skip:!local}, async () => {
 const db=new PrismaClient(); const key=randomUUID();
 try {
 const wh=await db.warehouse.upsert({where:{code:'WH-MAIN'},update:{},create:{code:'WH-MAIN',name:'HQ test'}});
 const p=await db.product.create({data:{productId:key,sku:key,name:'HQ bulk test',category:'freeze_dried',unit:'g',price:1,priceTiers:{create:[{weightGrams:30,unit:'g',price:1},{weightGrams:50,unit:'g',price:1}]},inventoryBalances:{create:{warehouseId:wh.id,quantity:1300,unit:'g',lastCountedAt:new Date()}}},include:{priceTiers:true}});
 const stock=()=>db.inventoryBalance.findUniqueOrThrow({where:{productId_warehouseId:{productId:p.id,warehouseId:wh.id}}}).then(b=>b.quantity);
 const posBefore=await db.$queryRaw`SELECT md5(coalesce(string_agg(row_to_json(s)::text, '' ORDER BY s.id),'')) AS hash FROM "MerchantStock" s`;
 const shipment=async (grams=30,qty=1)=>db.shipment.create({data:{shipmentNumber:randomUUID(),type:'customer_order',items:{create:{productId:p.id,productName:p.name,sku:p.sku,quantity:qty,weightGrams:grams,unit:'g'}}}});
 const a=await shipment(); assert.equal(await stock(),1300);
 await db.shipment.update({where:{id:a.id},data:{status:'packed'}});assert.equal(await stock(),1300);
 await db.shipment.update({where:{id:a.id},data:{status:'shipped'}});assert.equal(await stock(),1270);
 await db.shipment.update({where:{id:a.id},data:{status:'shipped'}});assert.equal(await stock(),1270);
 await db.shipment.update({where:{id:a.id},data:{status:'delivered'}});assert.equal(await stock(),1270);
 const b=await shipment(50,2);await db.shipment.update({where:{id:b.id},data:{status:'shipped'}});assert.equal(await stock(),1170);
 const mixed=await db.shipment.create({data:{shipmentNumber:randomUUID(),type:'merchant_restock',items:{create:[30,50].map(g=>({productId:p.id,productName:p.name,sku:p.sku,quantity:1,weightGrams:g,unit:'g'}))}}});
 await db.shipment.update({where:{id:mixed.id},data:{status:'shipped'}});assert.equal(await stock(),1090);
 await db.shipment.update({where:{id:mixed.id},data:{status:'cancelled'}});assert.equal(await stock(),1170);
 await db.shipment.update({where:{id:a.id},data:{status:'cancelled'}});assert.equal(await stock(),1200);
 await db.shipment.update({where:{id:a.id},data:{status:'cancelled'}});assert.equal(await stock(),1200);
 const ledger=await db.inventoryTransaction.findMany({where:{reference:`shipment:${a.id}`}});assert.equal(ledger.length,2);assert.equal(ledger.find(t=>t.type==='return_in')?.reversesId,ledger.find(t=>t.type==='sales_out')?.id);
 await assert.rejects(db.inventoryTransaction.delete({where:{id:ledger[0].id}}));
 await assert.rejects(db.shipmentItem.updateMany({where:{shipmentId:a.id},data:{quantity:9}}));
 const huge=await shipment(50,100);await assert.rejects(db.shipment.update({where:{id:huge.id},data:{status:'shipped'}}));assert.equal(await stock(),1200);assert.equal((await db.shipment.findUniqueOrThrow({where:{id:huge.id}})).status,'pending');
 const cancelled=await shipment();await db.shipment.update({where:{id:cancelled.id},data:{status:'cancelled'}});assert.equal(await stock(),1200);
 const invalid=await shipment(99);await assert.rejects(db.shipment.update({where:{id:invalid.id},data:{status:'shipped'}}));assert.equal(await stock(),1200);
 const order=await db.order.create({data:{orderNumber:randomUUID(),source:'manual',subtotal:1,total:1,items:{create:{productId:p.id,productName:p.name,sku:p.sku,quantity:1,unitPrice:1,subtotal:1,weightGrams:30,unit:'g'}}}});
 await db.order.update({where:{id:order.id},data:{status:'completed'}});assert.equal(await stock(),1170);
 await db.order.update({where:{id:order.id},data:{paymentStatus:'refunded'}});assert.equal(await stock(),1200);
 await db.order.update({where:{id:order.id},data:{paymentStatus:'refunded'}});assert.equal(await stock(),1200);
 const uncounted=await db.product.create({data:{productId:randomUUID(),sku:randomUUID(),name:'uncounted',category:'treats',unit:'g',price:1,priceTiers:{create:{weightGrams:30,unit:'g',price:1}}}});
 const fail=await db.shipment.create({data:{shipmentNumber:randomUUID(),type:'customer_order',items:{create:[{productId:p.id,productName:p.name,sku:p.sku,quantity:1,weightGrams:30},{productId:uncounted.id,productName:uncounted.name,sku:uncounted.sku,quantity:1,weightGrams:30}]}}});
 await assert.rejects(db.shipment.update({where:{id:fail.id},data:{status:'shipped'}}));assert.equal(await stock(),1200);
 const q=await db.product.create({data:{productId:randomUUID(),sku:randomUUID(),name:'quail',category:'freeze_dried',unit:'隻',price:1,priceTiers:{create:[{unit:'隻',unitQty:1,price:1},{unit:'隻',unitQty:3,price:3}]},inventoryBalances:{create:{warehouseId:wh.id,quantity:4,unit:'隻',lastCountedAt:new Date()}}},include:{priceTiers:true}});
 const qs=await db.shipment.create({data:{shipmentNumber:randomUUID(),type:'customer_order',items:{create:{productId:q.id,productName:q.name,sku:q.sku,quantity:1,variantKey:q.priceTiers.find(t=>t.unitQty===3)!.id}}}});
 await db.shipment.update({where:{id:qs.id},data:{status:'shipped'}});assert.equal((await db.inventoryBalance.findUniqueOrThrow({where:{productId_warehouseId:{productId:q.id,warehouseId:wh.id}}})).quantity,1);
 // A signed/versioned Shopify cancellation reaches the same inverse ledger,
 // including after physical shipment; repeats stay idempotent.
 const externalId=randomUUID();
 const shopOrder=await db.order.create({data:{orderNumber:randomUUID(),source:'shopify',externalStore:'hq-test.myshopify.com',externalOrderId:externalId,subtotal:1,total:1}});
 const shopShipment=await db.shipment.create({data:{shipmentNumber:randomUUID(),type:'customer_order',orderId:shopOrder.id,items:{create:{productId:p.id,productName:p.name,sku:p.sku,quantity:1,weightGrams:30}}}});
 const beforeShopify=await stock();
 await db.shipment.update({where:{id:shopShipment.id},data:{status:'shipped'}});assert.equal(await stock(),beforeShopify-30);
 const cancelInput={topic:'orders/cancelled' as const,shopDomain:'hq-test.myshopify.com',webhookId:randomUUID(),orderId:externalId,sourceUpdatedAt:new Date().toISOString(),db:createPrismaShopifyStore(db)};
 await syncShopifyCancellation(cancelInput);assert.equal(await stock(),beforeShopify);
 await syncShopifyCancellation(cancelInput);assert.equal(await stock(),beforeShopify);
 assert.equal((await db.order.findUniqueOrThrow({where:{id:shopOrder.id}})).status,'cancelled');
 // Two concurrent sources cannot both spend the same final 30g.
 await db.inventoryBalance.update({where:{productId_warehouseId:{productId:p.id,warehouseId:wh.id}},data:{quantity:30}});
 const c1=await shipment(),c2=await shipment();const outcomes=await Promise.allSettled([c1,c2].map(s=>db.shipment.update({where:{id:s.id},data:{status:'shipped'}})));assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal(await stock(),0);
 // Historical shipped rows predate this migration and must never be charged on delivery.
 const historical=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
   return tx.shipment.create({data:{shipmentNumber:randomUUID(),type:'customer_order',status:'shipped',items:{create:{productId:p.id,productName:p.name,sku:p.sku,quantity:1,weightGrams:30}}}});
 });
 await db.shipment.update({where:{id:historical.id},data:{status:'delivered'}});assert.equal(await stock(),0);
 assert.equal(await db.inventoryTransaction.count({where:{reference:`shipment:${historical.id}`}}),0);
 const blockedOrder=await db.order.create({data:{orderNumber:randomUUID(),source:'shopify',omsStatus:'NEW',subtotal:1,total:1}});
 const blockedShipment=await db.shipment.create({data:{shipmentNumber:randomUUID(),type:'customer_order',orderId:blockedOrder.id,items:{create:{productId:p.id,productName:p.name,sku:p.sku,quantity:1,weightGrams:30}}}});
 await assert.rejects(db.shipment.update({where:{id:blockedShipment.id},data:{status:'shipped'}}),/OMS/);
 assert.equal(await stock(),0);
 const posAfter=await db.$queryRaw`SELECT md5(coalesce(string_agg(row_to_json(s)::text, '' ORDER BY s.id),'')) AS hash FROM "MerchantStock" s`;assert.deepEqual(posBefore,posAfter);
 } finally {await db.$disconnect();}
});
