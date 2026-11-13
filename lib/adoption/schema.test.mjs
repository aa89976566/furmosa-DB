import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('isolated Postgres migration creates unique source identity, lease and private RLS tables', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('../../prisma/migrations/20261113140000_adoption_sync/migration.sql', import.meta.url), 'utf8'));
    const tables = await db.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('adoption_source_records','adoption_sync_runs') ORDER BY relname");
    assert.equal(tables.rows.length, 2); assert.ok(tables.rows.every(r => r.relrowsecurity));
    await db.query("INSERT INTO adoption_source_records(id,source,source_id,source_url,data,updated_at) VALUES ('1','loverabbit','197','url','{}',now())");
    await assert.rejects(() => db.query("INSERT INTO adoption_source_records(id,source,source_id,source_url,data,updated_at) VALUES ('2','loverabbit','197','url','{}',now())"));
    await db.query("INSERT INTO adoption_sync_runs(id,source,origin,lease_key,errors) VALUES ('1','loverabbit','scheduled','loverabbit','[]')");
    await assert.rejects(() => db.query("INSERT INTO adoption_sync_runs(id,source,origin,lease_key,errors) VALUES ('2','loverabbit','scheduled','loverabbit','[]')"));
  } finally { await db.close(); }
});
