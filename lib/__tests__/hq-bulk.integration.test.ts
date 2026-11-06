import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { bulkConsumption } from '../inventory/bulk';
import { createPrismaShopifyStore } from '../shopify/webhook-store';
import { syncShopifyCancellation } from '../shopify/shipment-events';
import { shopifySnapshot, snapshotHash } from '../shopify/intake-policy';
import { runReview } from '../orders/review-service';
import { reviewDraft } from '../orders/review-policy';

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
test('paid source approval persists review evidence accepted by the real shipment ledger gate', { skip: !local }, async () => {
 const db = new PrismaClient();
 try {
   const key = randomUUID();
   const externalId = BigInt(`0x${key.replace(/-/g, '')}`).toString();
   const now = new Date('2026-11-06T00:00:00Z');
   const actor = await db.user.create({ data: { email: `${key}@example.invalid`, name: 'CI review', role: 'admin', passwordHash: 'not-a-login-credential' } });
   const wh = await db.warehouse.upsert({ where: { code: 'WH-MAIN' }, update: {}, create: { code: 'WH-MAIN', name: 'HQ test' } });
   const product = await db.product.create({ data: {
     productId: key, sku: key, sourceSku: key, name: 'CI approval dispatch', category: 'freeze_dried', unit: 'g', price: 100, defaultTemperature: 'ambient',
     priceTiers: { create: { weightGrams: 30, unit: 'g', unitQty: 1, price: 100, sku: key, shopifySku: key, status: 'active' } },
     inventoryBalances: { create: { warehouseId: wh.id, quantity: 100, unit: 'g', lastCountedAt: now } },
   } });
   const snapshot = shopifySnapshot({
     id: externalId, name: '#CI-REVIEW', currency: 'TWD', created_at: now.toISOString(), updated_at: now.toISOString(), financial_status: 'paid',
     subtotal_price: '100.00', total_discounts: '0.00', total_price: '160.00',
     total_shipping_price_set: { shop_money: { amount: '60.00' } },
     line_items: [{ sku: key, title: product.name, quantity: 1, price: '100.00', requires_shipping: true }],
     shipping_address: { name: 'CI recipient', phone: '0912345678', address1: 'CI isolated address' },
     shipping_lines: [{ title: '宅配', code: 'HOME' }], note_attributes: [],
   });
   const order = await db.order.create({ data: {
     orderNumber: key, source: 'shopify', externalStore: `${key}.myshopify.com`, externalOrderId: externalId,
     omsStatus: 'NEW', status: 'pending_review', paymentStatus: 'paid', subtotal: 100, total: 160,
     orderedAt: now, shopifySourceUpdatedAt: now, shopifySnapshot: snapshot,
   } });
   const command = { orderId: order.id, actorId: actor.id, sourceHash: snapshotHash(snapshot), sourceOnly: true,
     draft: reviewDraft({ lines: [], method: 'home', temperature: 'ambient', recipient: 'CI recipient', phone: '0912345678', address: 'CI isolated address' }) };
   const checked = await runReview(db, { ...command, action: 'check' });
   assert.equal(checked.ok, true, JSON.stringify(checked));
   const approved = await runReview(db, { ...command, action: 'approve' });
   assert.equal(approved.ok, true, JSON.stringify(approved));
   const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
   assert.equal(saved.omsReviewedById, actor.id);
   assert.ok(saved.omsReviewedAt instanceof Date);
   const shipments = await db.shipment.findMany({ where: { orderId: order.id } });
   assert.equal(shipments.length, 1);
   const shipment = shipments[0];
   assert.equal(shipment.status, 'pending');
   const balance = () => db.inventoryBalance.findUniqueOrThrow({ where: { productId_warehouseId: { productId: product.id, warehouseId: wh.id } } });
   assert.equal((await balance()).quantity, 100, 'approval must not deduct stock');
   await db.shipment.update({ where: { id: shipment.id }, data: { status: 'shipped' } });
   assert.equal((await balance()).quantity, 70, 'real deferred OMS gate must accept the saved review');
   await db.shipment.update({ where: { id: shipment.id }, data: { status: 'shipped' } });
   assert.equal((await balance()).quantity, 70, 'repeated dispatch must not deduct again');
   assert.equal(await db.inventoryTransaction.count({ where: { reference: `shipment:${shipment.id}`, type: 'sales_out' } }), 1);
 } finally { await db.$disconnect(); }
});
test('HQ ledger is atomic, allows advisory negative stock, skips made-to-order, and stays isolated from POS', {skip:!local}, async () => {
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
 await assert.rejects(db.shipment.update({where:{id:a.id},data:{status:'shipped'}}));
 assert.equal(await stock(),1200);
 const ledger=await db.inventoryTransaction.findMany({where:{reference:`shipment:${a.id}`}});assert.equal(ledger.length,2);assert.equal(ledger.find(t=>t.type==='return_in')?.reversesId,ledger.find(t=>t.type==='sales_out')?.id);
 await assert.rejects(db.inventoryTransaction.delete({where:{id:ledger[0].id}}));
 await assert.rejects(db.shipmentItem.updateMany({where:{shipmentId:a.id},data:{quantity:9}}));
 const huge=await shipment(50,100);await db.shipment.update({where:{id:huge.id},data:{status:'shipped'}});assert.equal(await stock(),-3800);assert.equal((await db.shipment.findUniqueOrThrow({where:{id:huge.id}})).status,'shipped');
 const cancelled=await shipment();await db.shipment.update({where:{id:cancelled.id},data:{status:'cancelled'}});assert.equal(await stock(),-3800);
 const invalid=await shipment(99);await assert.rejects(db.shipment.update({where:{id:invalid.id},data:{status:'shipped'}}));assert.equal(await stock(),-3800);
 const order=await db.order.create({data:{orderNumber:randomUUID(),source:'manual',subtotal:1,total:1,items:{create:{productId:p.id,productName:p.name,sku:p.sku,quantity:1,unitPrice:1,subtotal:1,weightGrams:30,unit:'g'}}}});
 await db.order.update({where:{id:order.id},data:{status:'completed'}});assert.equal(await stock(),-3830);
 await db.order.update({where:{id:order.id},data:{paymentStatus:'refunded'}});assert.equal(await stock(),-3800);
 await db.order.update({where:{id:order.id},data:{paymentStatus:'refunded'}});assert.equal(await stock(),-3800);
 const uncounted=await db.product.create({data:{productId:randomUUID(),sku:randomUUID(),name:'uncounted',category:'treats',unit:'g',price:1,priceTiers:{create:{weightGrams:30,unit:'g',price:1}}}});
 const advisory=await db.shipment.create({data:{shipmentNumber:randomUUID(),type:'customer_order',items:{create:[{productId:p.id,productName:p.name,sku:p.sku,quantity:1,weightGrams:30},{productId:uncounted.id,productName:uncounted.name,sku:uncounted.sku,quantity:1,weightGrams:30}]}}});
 await db.shipment.update({where:{id:advisory.id},data:{status:'shipped'}});assert.equal(await stock(),-3830);
 const uncountedBalance=await db.inventoryBalance.findUniqueOrThrow({where:{productId_warehouseId:{productId:uncounted.id,warehouseId:wh.id}}});assert.equal(uncountedBalance.quantity,-30);assert.equal(uncountedBalance.lastCountedAt,null);
 const madeToOrder=await db.product.create({data:{productId:randomUUID(),sku:'FUR-0002',name:'原味雞霸',category:'treats',unit:'片',price:89,priceTiers:{create:{unit:'片',unitQty:1,price:89}}}});
 const madeToOrderShipment=await db.shipment.create({data:{shipmentNumber:randomUUID(),type:'merchant_restock',items:{create:{productId:madeToOrder.id,productName:madeToOrder.name,sku:madeToOrder.sku,quantity:4,unit:'片'}}}});
 await db.shipment.update({where:{id:madeToOrderShipment.id},data:{status:'shipped'}});
 assert.equal(await db.inventoryTransaction.count({where:{reference:`shipment:${madeToOrderShipment.id}`}}),0);
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
 // Concurrent sources both ship; the shared ledger records the resulting negative stock.
 await db.inventoryBalance.update({where:{productId_warehouseId:{productId:p.id,warehouseId:wh.id}},data:{quantity:30}});
 const c1=await shipment(),c2=await shipment();const outcomes=await Promise.allSettled([c1,c2].map(s=>db.shipment.update({where:{id:s.id},data:{status:'shipped'}})));assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,2);assert.equal(await stock(),-30);
 // Historical shipped rows predate this migration and must never be charged on delivery.
 const historical=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
   return tx.shipment.create({data:{shipmentNumber:randomUUID(),type:'customer_order',status:'shipped',items:{create:{productId:p.id,productName:p.name,sku:p.sku,quantity:1,weightGrams:30}}}});
 });
 await db.shipment.update({where:{id:historical.id},data:{status:'delivered'}});assert.equal(await stock(),-30);
 assert.equal(await db.inventoryTransaction.count({where:{reference:`shipment:${historical.id}`}}),0);
 const blockedOrder=await db.order.create({data:{orderNumber:randomUUID(),source:'shopify',omsStatus:'NEW',subtotal:1,total:1}});
 const blockedShipment=await db.shipment.create({data:{shipmentNumber:randomUUID(),type:'customer_order',orderId:blockedOrder.id,items:{create:{productId:p.id,productName:p.name,sku:p.sku,quantity:1,weightGrams:30}}}});
 await assert.rejects(db.shipment.update({where:{id:blockedShipment.id},data:{status:'shipped'}}),/OMS/);
 assert.equal(await stock(),-30);
 const posAfter=await db.$queryRaw`SELECT md5(coalesce(string_agg(row_to_json(s)::text, '' ORDER BY s.id),'')) AS hash FROM "MerchantStock" s`;assert.deepEqual(posBefore,posAfter);
 } finally {await db.$disconnect();}
});
