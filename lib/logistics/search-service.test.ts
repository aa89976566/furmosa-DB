import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSearchService } from './search-service';
const directory = { fetchedAt: 100, stores: [{id:'001',name:'示範店',address:'臺北市',serviceType:'UNIMART' as const}] };
test('selection retains auth and validation gates before provider access', async () => {
  let calls = 0;
  const search = createSearchService({ now: () => 100, load: async () => { calls++; return directory; }, enabled: () => true, frozenConfirmed: () => false });
  assert.equal((await search(false, '', 'ambient', '001')).status, 401);
  assert.equal((await search(true, '', 'ambient', '')).status, 400);
  assert.equal((await search(true, '', 'frozen', '001')).status, 503);
  assert.equal(calls, 0);
});
test('selection uses canonical directory and refreshes before accepting removed stores', async () => {
  let now = 100, calls = 0;
  const search = createSearchService({ now: () => now, load: async () => {
    calls++;
    return calls === 1 ? directory : { fetchedAt: now, stores: [{ ...directory.stores[0], id: '002' }] };
  }, enabled: () => true, frozenConfirmed: () => false });
  const result = await search(true, '', 'ambient', '001');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.store, directory.stores[0]);
  assert.equal((await search(true, '', 'ambient', 'missing')).status, 409);
  assert.equal(calls, 1);
  now += 3600000;
  assert.equal((await search(true, '', 'ambient', '001')).status, 409);
  assert.equal(calls, 2);
});
test('failed refresh cannot confirm a previously selected store', async () => {
  let now = 100;
  const search = createSearchService({ now: () => now, load: async () => {
    if (now > 100) throw new Error('private provider detail');
    return directory;
  }, enabled: () => true, frozenConfirmed: () => false });
  assert.equal((await search(true, '', 'ambient', '001')).status, 200);
  now += 3600000;
  const result = await search(true, '', 'ambient', '001');
  assert.equal(result.status, 503);
  assert.ok(!JSON.stringify(result).includes('private provider detail'));
});
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
