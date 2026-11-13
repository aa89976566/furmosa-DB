import test from 'node:test';
import assert from 'node:assert/strict';
import { runAdoptionSync, displayAnimal } from './sync-worker.mjs';

const detail = (status = '已開放領養', story = '原始照護說明') => `<div class="products-info"><h1>回甘 - 收容案</h1><div class="product-text">送養狀態：${status}</div><div class="product-text">兔兔性別：女生<br>兔兔品種：道奇兔</div><img data-src="/upload/rabbit.jpg"></div><div class="products-detail"><article itemprop="text">${story}</article>`;
const listing = '<ul class="product-list"><li><a href="/products_detail/1620">回甘</a></li></ul>';
function memoryDb() {
  let serial = 0;
  const records = [], runs = [];
  function match(row, where = {}) { return Object.entries(where).every(([k, v]) => {
    if (k === 'source_sourceId') return row.source === v.source && row.sourceId === v.sourceId;
    if (v && typeof v === 'object') { if ('lte' in v) return row[k] <= v.lte; if ('in' in v) return v.in.includes(row[k]); }
    return row[k] === v;
  }); }
  function apply(row, data) { for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === 'object' && 'increment' in v ? row[k] + v.increment : v; return { ...row }; }
  function table(rows, defaults) { return {
    findFirst: async q => (await table(rows, defaults).findMany(q))[0] || null,
    findMany: async ({ where, orderBy, take } = {}) => {
      const out = rows.filter(r => match(r, where));
      for (const order of [...(Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [])].reverse()) { const [k, dir] = Object.entries(order)[0]; out.sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (dir === 'asc' ? 1 : -1)); }
      return out.slice(0, take || out.length).map(r => ({ ...r }));
    },
    create: async ({ data }) => { const row = { id: String(++serial), ...defaults(), ...data }; rows.push(row); return { ...row }; },
    update: async ({ where, data }) => { const row = rows.find(r => match(r, where)); assert.ok(row); return apply(row, data); },
    updateMany: async ({ where, data }) => { const found = rows.filter(r => match(r, where)); found.forEach(r => apply(r, data)); return { count: found.length }; },
    upsert: async ({ where, create, update }) => { const row = rows.find(r => match(r, where)); return row ? apply(row, update) : table(rows, defaults).create({ data: create }); },
  }; }
  const db = { records, runs, $executeRaw: async () => 1, adoptionSourceRecord: table(records, () => ({ sourceStatus: '待確認', published: false, contentHash: '', nextCheckAt: new Date(0), consecutiveErrors: 0, missingCount: 0, lastError: null })), adoptionSyncRun: table(runs, () => ({ startedAt: new Date('2026-11-13T00:00:00Z'), status: 'running' })) };
  db.$transaction = fn => fn(db);
  return db;
}
function settings(html = detail()) { return { enabled: true, now: () => new Date('2026-11-13T00:00:00Z'), pause: async () => {}, fetcher: async url => new Response(url.includes('products_detail') ? html : listing, { headers: { 'content-type': 'text/html' } }) }; }
test('disabled worker never touches DB', async () => assert.deepEqual(await runAdoptionSync({}, { enabled: false }), { skipped: 'disabled' }));
test('first scan discovers and publishes verified source record', async () => {
  const db = memoryDb(); const run = await runAdoptionSync(db, settings());
  assert.equal(run.status, 'success'); assert.equal(run.checked, 1); assert.equal(run.listComplete, true);
  assert.equal(db.records[0].published, true); assert.equal(db.records[0].data.name, '回甘'); assert.equal(db.runs[0].leaseKey, null);
});
test('second scheduled run survives process restart and hides explicit closed status', async () => {
  const db = memoryDb(); await runAdoptionSync(db, settings());
  db.records[0].nextCheckAt = new Date(0);
  const opts = settings(detail('未開放領養')); opts.now = () => new Date('2026-11-13T00:05:00Z');
  const result = await runAdoptionSync(db, opts);
  assert.equal(result.checked, 1); assert.equal(db.records[0].published, false); assert.equal(db.runs.length, 2);
});
test('source 503 preserves published record and last successful check', async () => {
  const db = memoryDb(); await runAdoptionSync(db, settings());
  db.records[0].nextCheckAt = new Date(0); const checkedAt = db.records[0].lastCheckedAt;
  const opts = settings(); opts.now = () => new Date('2026-11-13T00:05:00Z'); opts.fetcher = async () => new Response('Unavailable', { status: 503 });
  await runAdoptionSync(db, opts); assert.equal(db.records[0].published, true); assert.equal(db.records[0].lastCheckedAt, checkedAt); assert.equal(db.runs[1].status, 'partial');
});
test('two independent direct 404 checks pause listing without claiming adopted', async () => {
  const db = memoryDb(); await runAdoptionSync(db, settings());
  const opts = settings(); opts.fetcher = async () => new Response('', { status: 404 });
  for (const minute of [5, 10]) { db.records[0].nextCheckAt = new Date(0); opts.now = () => new Date(`2026-11-13T00:${minute.toString().padStart(2, '0')}:00Z`); await runAdoptionSync(db, opts); if (minute === 5) assert.equal(db.records[0].published, true); }
  assert.equal(db.records[0].published, false); assert.equal(db.records[0].sourceStatus, '原頁已移除，待確認');
});
test('live lease prevents duplicate scheduled work', async () => {
  const db = memoryDb(); db.runs.push({ id: 'busy', source: 'loverabbit', leaseKey: 'loverabbit', leaseUntil: new Date('2026-11-13T01:00:00Z') });
  assert.equal((await runAdoptionSync(db, settings())).skipped, 'busy_or_not_due');
});
test('unknown parser output never replaces source fields', async () => {
  const db = memoryDb(); await runAdoptionSync(db, settings()); db.records[0].nextCheckAt = new Date(0);
  const opts = settings('<html>layout changed</html>'); opts.now = () => new Date('2026-11-13T00:05:00Z');
  await runAdoptionSync(db, opts); assert.equal(db.records[0].published, true); assert.equal(db.records[0].data.name, '回甘');
});
test('display maps guinea pigs and preserves source text without inferred personality', () => {
  const a = displayAnimal({ id: '1', url: 'source', name: '小白豬 - 案件', status: '已開放領養', photos: ['photo'], basic: ['天竺鼠性別：女生'], description: '請向原單位確認' }, '台北愛兔之家');
  assert.equal(a.species, 'guinea'); assert.deepEqual(a.behavior, []); assert.equal(a.description, '請向原單位確認');
});
