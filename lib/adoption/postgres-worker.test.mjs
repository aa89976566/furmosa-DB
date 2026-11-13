import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { runAdoptionSync } from './sync-worker.mjs';

const connection = process.env.ADOPTION_TEST_DATABASE_URL || process.env.DATABASE_URL || '';
let isolated = false;
try { const u = new URL(connection); isolated = process.env.NODE_ENV === 'test' && ['localhost', '127.0.0.1'].includes(u.hostname) && u.pathname === '/ci'; } catch {}
test('real isolated Postgres executes lease, upsert and later scheduled status transition', { skip: !isolated }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: connection } } });
  const start = new Date();
  const listing = '<ul class="product-list"><li><a href="/products_detail/900000001">animal</a></li></ul>';
  let status = '已開放領養';
  const opts = { enabled: true, now: () => start, pause: async () => {}, fetcher: async url => new Response(url.includes('products_detail') ? `<div class="products-info"><h1>CI rabbit</h1><div class="product-text">送養狀態：${status}</div><div class="product-text">兔兔性別：女生</div><img src="/upload/test.jpg"></div><div class="products-detail"><article itemprop="text">CI only</article>` : listing, { headers: { 'content-type': 'text/html' } }) };
  try {
    const first = await runAdoptionSync(db, opts);
    assert.equal(first.status, 'success'); assert.equal(first.checked, 1);
    let row = await db.adoptionSourceRecord.findUniqueOrThrow({ where: { source_sourceId: { source: 'loverabbit', sourceId: '900000001' } } });
    assert.equal(row.published, true);
    status = '未開放領養'; opts.now = () => new Date(+start + 300000);
    await db.adoptionSourceRecord.update({ where: { id: row.id }, data: { nextCheckAt: start } });
    const second = await runAdoptionSync(db, opts); assert.equal(second.status, 'success');
    row = await db.adoptionSourceRecord.findUniqueOrThrow({ where: { id: row.id } }); assert.equal(row.published, false);
    const runs = await db.adoptionSyncRun.findMany({ where: { source: 'loverabbit' } });
    assert.equal(runs.length, 2); assert.ok(runs.every(r => r.leaseKey === null && r.origin === 'scheduled'));
  } finally { await db.$disconnect(); }
});
