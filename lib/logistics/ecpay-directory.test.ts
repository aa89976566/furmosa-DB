import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logisticsMac, fetchDirectory } from './ecpay-directory';
// Public ECPay documentation example, NOT merchant credentials.
test('matches official logistics MD5 example', () => {
  const params = { MerchantID:'2000933', MerchantTradeNo:'A20130312153023', MerchantTradeDate:'2013/03/12 15:30:23', LogisticsType:'CVS', LogisticsSubType:'FAMIC2C', GoodsAmount:'1000', IsCollection:'N', ServerReplyURL:'https://www.ecpay.com.tw/ServerReplyURL', SenderName:'寄件者姓名', ReceiverName:'收件者姓名', ReceiverStoreID:'001779' };
  assert.equal(logisticsMac(params, 'XBERn1YOvpM9nfZc', 'h1ONHk4P4yqbl5LK'), '692FD6E2CDB539CCDB7206C76DC239AD');
});
const config = { merchantId:'123', hashKey:'fixture-key', hashIV:'fixture-iv', environment:'stage' as const };
const data = { RtnCode:1, StoreList:[{ CvsType:'UNIMART', StoreInfo:[{StoreId:'001', StoreName:'示範', StoreAddr:'示範地址'}] }] };
test('posts only to directory endpoint and omits secret keys from body', async () => {
  const result = await fetchDirectory(config, 'UNIMART', { now:()=>100, fetch:async (url, init) => {
    assert.equal(url, 'https://logistics-stage.ecpay.com.tw/Helper/GetStoreList');
    assert.equal(init?.redirect, 'error'); assert.equal(init?.method, 'POST');
    assert.ok(!String(init?.body).includes('fixture'));
    assert.equal(new URLSearchParams(String(init?.body)).get('CvsType'), 'UNIMART');
    return Response.json(data);
  }});
  assert.equal(result.stores[0].id, '001'); assert.equal(result.fetchedAt, 100);
});
test('requests the dedicated 7-ELEVEN frozen directory without changing credentials', async () => {
  const frozenData = { RtnCode:1, StoreList:[{ CvsType:'UNIMARTFREEZE', StoreInfo:[{StoreId:'009', StoreName:'冷凍示範', StoreAddr:'示範地址'}] }] };
  const result = await fetchDirectory(config, 'UNIMARTFREEZE', { now:()=>100, fetch:async (_url, init) => {
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get('CvsType'), 'UNIMARTFREEZE');
    assert.ok(body.get('CheckMacValue'));
    return Response.json(frozenData);
  }});
  assert.equal(result.stores[0].serviceType, 'UNIMARTFREEZE');
});
test('rejects empty, invalid JSON, provider errors and HTTP errors without leaking details', async () => {
  for (const response of [Response.json({RtnCode:0, RtnMsg:'private'}), new Response('private'), Response.json({RtnCode:1,StoreList:[]}), new Response('private',{status:500})]) {
    await assert.rejects(fetchDirectory(config,'UNIMART',{now:()=>1,fetch:async()=>response}), /^Error: 暫時無法取得門市資料$/);
  }
});
test('timeout aborts request with safe message', async () => {
  await assert.rejects(fetchDirectory(config,'UNIMART',{now:()=>1,timeoutMs:5,fetch:async (_url,init)=>new Promise((_resolve,reject)=>{
    init?.signal?.addEventListener('abort',()=>reject(new Error('private')));
  })}), /門市查詢逾時/);
});
test('missing configuration never calls network', async () => {
  await assert.rejects(fetchDirectory({...config,hashKey:''},'UNIMART',{now:()=>1,fetch:async()=>{throw new Error('must not run');}}), /設定不完整/);
});
