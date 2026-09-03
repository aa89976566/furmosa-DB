import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deletionBlocker } from '../delete-policy';
import { changeOrderDeletion } from '../delete-service';
import { sourceLineTotal } from '../../shopify/snapshot-view';
const base = { source: 'shopify', omsStatus: 'NEW', paymentStatus: 'unpaid', status: 'pending_review', fulfillmentStatus: 'pending', shippedAt: null, completedAt: null, merchantId: null, subscriptionId: null };
test('刪除阻擋付款、退款、出貨、帳務及舊流程', () => {
  assert.equal(deletionBlocker(base, false), null);
  for (const change of [{paymentStatus:'paid'}, {paymentStatus:'partial'}, {paymentStatus:'refunded'}, {omsStatus:null}, {source:'manual'}, {omsStatus:'FULFILLED'}, {status:'confirmed'}, {merchantId:'m'}, {subscriptionId:'s'}]) assert.ok(deletionBlocker({...base,...change},false));
  assert.ok(deletionBlocker(base,true));
});
test('Shopify 品項小計保留兩位小數，不影響付款金額', () => {
  assert.equal(sourceLineTotal('0.10',3),'0.30');
  assert.equal(sourceLineTotal('100.00',1),'100.00');
  assert.equal(sourceLineTotal('bad',1),null);
  assert.equal(sourceLineTotal('1.00',-1),null);
});
function fixture() {
  const order:any={...base,id:'o',orderNumber:'TEST-1',externalStore:'test.myshopify.com',externalOrderId:'123',deletedAt:null,omsReviewedAt:new Date(),_count:{shipments:0,merchantStockTxns:0}};
  const audits:any[]=[]; let role='admin'; const calls:string[]=[];
  const tx:any={user:{findUnique:async()=>({role})},$executeRaw:async()=>{calls.push('lock');},order:{findUnique:async()=>order,findUniqueOrThrow:async()=>{calls.push('read');return order;},update:async({data}:any)=>{calls.push('update');Object.assign(order,data);return order;}},campaignApplication:{findFirst:async()=>null},orderReview:{findFirst:async()=>null},statusAuditLog:{create:async({data}:any)=>audits.push(data)}};
  const run=(action:'delete'|'restore',reason=action === 'delete' ? '測試訂單' : '')=>changeOrderDeletion({$transaction:async(fn:any)=>fn(tx)} as any,{actorId:'u',orderId:'o',action,reason});
  return {order,audits,calls,run,setRole:(v:string)=>{role=v;}};
}
test('刪除可重送、保留來源 ID、還原必須重新審核',async()=>{
  const f=fixture();await f.run('delete'); assert.ok(f.order.deletedAt);assert.equal(f.order.externalOrderId,'123');assert.equal(f.audits.length,1);
  await f.run('delete');assert.equal(f.audits.length,1);
  await f.run('restore');assert.equal(f.order.deletedAt,null);assert.equal(f.order.omsStatus,'NEW');assert.equal(f.order.omsReviewedAt,null);assert.equal(f.audits.length,2);
  assert.ok(f.calls.indexOf('lock')<f.calls.indexOf('update'));
});
test('伺服器拒絕非管理員、無效刪除原因與已有出貨',async()=>{
  const f=fixture();f.setRole('staff');await assert.rejects(f.run('delete'),/管理員/);f.setRole('admin');await assert.rejects(f.run('delete','自行填寫'),/選擇刪除原因/);
  f.order._count.shipments=1;await assert.rejects(f.run('delete'),/出貨/);assert.equal(f.order.deletedAt,null);
});
test('刪除保存固定原因、操作者與時間紀錄',async()=>{
  const f=fixture();await f.run('delete','客人取消');
  assert.equal(f.order.deletionReason,'客人取消');assert.equal(f.order.deletedById,'u');assert.ok(f.order.deletedAt);
  assert.equal(f.audits[0].actorId,'u');assert.equal(f.audits[0].newStatus,'DELETED');
  await f.run('restore');assert.equal(f.order.deletedAt,null);
});
