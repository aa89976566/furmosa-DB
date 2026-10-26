import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { postPurchaseReceipt } from '../post-purchase-receipt';
import { createPurchaseOrder, receivePurchaseOrder } from '../purchase-orders';

// Explicit loopback CI database only; never use DATABASE_URL as a fallback.
const candidate = process.env.INVENTORY_TEST_DATABASE_URL;
let isolated: string | undefined;
if (candidate) {
  try {
  const u = new URL(candidate);
  if (['localhost','127.0.0.1'].includes(u.hostname) && ['ci','inventory_test'].includes(u.pathname.slice(1))) isolated = candidate;
  } catch { /* Invalid test configuration never falls back to the runtime DB. */ }
}
test('PostgreSQL 分批收貨、重送、併發、舊單相容與原子回復', { skip: !isolated }, async () => {
  const db = new PrismaClient({datasources:{db:{url:isolated!}}});
  const stamp = randomUUID();
  const user = await db.user.create({data:{email:`${stamp}@inventory.test`,name:'CI',passwordHash:'not-a-login',role:'warehouse'}});
  const wh = await db.warehouse.create({data:{code:stamp,name:'CI isolated'}});
  const product = await db.product.create({data:{productId:stamp,sku:stamp,name:'CI product',price:1,unit:'g'}});
  const orders: string[] = [];
  async function order() {
    const o = await createPurchaseOrder(db,{vendorId:null,warehouseId:wh.id,supplierDocumentNumber:null,remindFromDate:new Date(),shippingCostCents:101,packagingCostCents:0,processingCostCents:0,taxAmountCents:0,discountAmountCents:0,note:null,createdById:user.id,items:[{productId:product.id,quantityGrams:1000,rawAmountCents:10001}],attachments:[]});
    orders.push(o.id);
    return {id:o.id,line:(await db.purchaseOrderItem.findFirstOrThrow({where:{purchaseOrderId:o.id}})).id};
  }
  const quantity = async () => (await db.inventoryBalance.findUnique({where:{productId_warehouseId:{productId:product.id,warehouseId:wh.id}}}))?.quantity ?? 0;
  try {
    const o = await order(); const key = randomUUID();
    const first = await receivePurchaseOrder(db,o.id,user.id,{key,lines:[{lineId:o.line,quantityGrams:400}]});
    assert.equal(await quantity(),400);
    assert.equal((await db.purchaseOrder.findUniqueOrThrow({where:{id:o.id}})).status,'pending_receipt');
    assert.equal((await receivePurchaseOrder(db,o.id,user.id,{key,lines:[{lineId:o.line,quantityGrams:400}]})).receipt.id,first.receipt.id);
    await assert.rejects(receivePurchaseOrder(db,o.id,user.id,{key,lines:[{lineId:o.line,quantityGrams:401}]}),/內容不同/);
    await assert.rejects(receivePurchaseOrder(db,o.id,user.id,{key:randomUUID(),lines:[{lineId:o.line,quantityGrams:601}]}),/超過/);
    const concurrent = await Promise.allSettled([1,2].map(() => receivePurchaseOrder(db,o.id,user.id,{key:randomUUID(),lines:[{lineId:o.line,quantityGrams:600}]})));
    assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(await quantity(),1000);
    const receipts = await db.purchaseReceipt.findMany({where:{sourceOrderId:o.id}});
    assert.equal(receipts.length,2);
    assert.equal(receipts.reduce((sum,x)=>sum+Number(x.totalAmount.mul(100)),0),10102);
    assert.equal((await db.purchaseOrder.findUniqueOrThrow({where:{id:o.id}})).status,'received');
    // Simulate an existing legacy receipt relationship without rewriting production data.
    const old = await order();
    await db.purchaseOrder.update({where:{id:old.id},data:{status:'received'}});
    await assert.rejects(receivePurchaseOrder(db,old.id,user.id,{key:randomUUID(),lines:[{lineId:old.line,quantityGrams:1000}]}),/結案/);
    const fail = await order();
    await db.inventoryBalance.update({where:{productId_warehouseId:{productId:product.id,warehouseId:wh.id}},data:{unit:'片'}});
    await assert.rejects(receivePurchaseOrder(db,fail.id,user.id,{key:randomUUID(),lines:[{lineId:fail.line,quantityGrams:400}]}),/單位/);
    assert.equal(await db.purchaseReceipt.count({where:{sourceOrderId:fail.id}}),0);
    assert.equal(await quantity(),1000);
    assert.equal((await db.purchaseOrder.findUniqueOrThrow({where:{id:fail.id}})).status,'pending_receipt');
    assert.equal(await db.inventoryTransaction.count({where:{productId:product.id}}),2);
    await db.inventoryBalance.update({where:{productId_warehouseId:{productId:product.id,warehouseId:wh.id}},data:{unit:'g'}});
    const direct = { submissionKey: randomUUID(), vendorId:null, warehouseId:wh.id,
      supplierDocumentNumber:null, receiptDate:new Date('2026-10-26T04:00:00Z'),
      shippingCostCents:0, packagingCostCents:0, processingCostCents:0,
      taxAmountCents:0, discountAmountCents:0, note:null, createdById:user.id,
      items:[{productId:product.id,quantityGrams:100,rawAmountCents:100}],attachments:[] };
    const attempts = await Promise.all([postPurchaseReceipt(db,direct),postPurchaseReceipt(db,direct)]);
    assert.equal(attempts[0].id,attempts[1].id);
    assert.equal(await quantity(),1100);
    assert.equal((await postPurchaseReceipt(db,direct)).id,attempts[0].id);
    await assert.rejects(postPurchaseReceipt(db,{...direct,note:'changed'}),/內容不同/);
    assert.equal(await quantity(),1100);
    assert.equal(await db.inventoryTransaction.count({where:{productId:product.id}}),3);

  } finally {
    // CI destroys the entire ephemeral PostgreSQL service after this job.
    // Keep immutable ledger records and their referenced fixtures intact until then.
    // Do not delete business rows or disable triggers to clean up a test.
    await db.$disconnect();
  }
});
