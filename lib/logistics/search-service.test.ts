import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSearchService } from './search-service';
const directory = { fetchedAt: 100, stores: [{id:'001',name:'示範店',address:'臺北市',serviceType:'UNIMART' as const}] };
test('unauthenticated and disabled requests never load provider', async () => {
  let calls=0;
  const search=createSearchService({now:()=>100,load:async()=>{calls++;return directory;},enabled:()=>false,frozenConfirmed:()=>false});
  assert.equal((await search(false,'示範','ambient')).status,401);
  assert.equal((await search(true,'示範','ambient')).status,503);
  assert.equal(calls,0);
});
test('invalid query and unconfirmed cold service do not load provider', async () => {
  let calls=0;
  const search=createSearchService({now:()=>100,load:async()=>{calls++;return directory;},enabled:()=>true,frozenConfirmed:()=>false});
  assert.equal((await search(true,'示範','other')).status,400);
  assert.equal((await search(true,'示範','frozen')).status,503);
  assert.equal((await search(true,'','ambient')).status,200);
  assert.equal(calls,0);
});
test('concurrent requests share a load and reuse fresh cache', async () => {
  let calls=0;
  const search=createSearchService({now:()=>100,load:async()=>{calls++;return directory;},enabled:()=>true,frozenConfirmed:()=>false});
  const results=await Promise.all([search(true,'示範','ambient'),search(true,'台北','ambient')]);
  assert.ok(results.every(r=>r.status===200));
  await search(true,'示範','ambient'); assert.equal(calls,1);
});
test('failed refresh does not serve stale data and backs off', async () => {
  let now=100,calls=0;
  const search=createSearchService({now:()=>now,load:async()=>{if(++calls>1)throw new Error('private');return directory;},enabled:()=>true,frozenConfirmed:()=>false});
  assert.equal((await search(true,'示範','ambient')).status,200);
  now+=3600000;
  const failed=await search(true,'示範','ambient');assert.equal(failed.status,503);assert.ok(!JSON.stringify(failed).includes('private'));
  await search(true,'示範','ambient');assert.equal(calls,2);
  now+=30001;await search(true,'示範','ambient');assert.equal(calls,3);
});
