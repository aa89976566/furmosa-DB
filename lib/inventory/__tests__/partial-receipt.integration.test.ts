import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createPurchaseOrder, receivePurchaseOrder } from '../purchase-orders';

// Explicit loopback CI database only; never use DATABASE_URL as a fallback.
const candidate = process.env.INVENTORY_TEST_DATABASE_URL;
let isolated: string | undefined;
if (candidate) {
  const u = new URL(candidate);
  if (['localhost','127.0.0.1'].includes(u.hostname) && ['ci','inventory_test'].includes(u.pathname.slice(1))) isolated = candidate;
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
  } finally {
    const rs = await db.purchaseReceipt.findMany({where:{sourceOrderId:{in:orders}},select:{id:true}});
    await db.purchaseReceiptItem.deleteMany({where:{purchaseReceiptId:{in:rs.map(x=>x.id)}}});
    await db.purchaseReceipt.deleteMany({where:{id:{in:rs.map(x=>x.id)}}});
    await db.purchaseOrderItem.deleteMany({where:{purchaseOrderId:{in:orders}}});
    await db.purchaseOrder.deleteMany({where:{id:{in:orders}}});
    await db.inventoryTransaction.deleteMany({where:{productId:product.id}});
    await db.inventoryBalance.deleteMany({where:{productId:product.id}});
    await db.product.delete({where:{id:product.id}});
    await db.warehouse.delete({where:{id:wh.id}});
    await db.user.delete({where:{id:user.id}});
    await db.$disconnect();
  }
});
