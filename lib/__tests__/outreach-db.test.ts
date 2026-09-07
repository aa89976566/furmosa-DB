import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { OutreachStore, asContact } from '../outreach/store.ts';
import { runContact, type Mail } from '../outreach/runner.ts';
import type { Candidate } from '../outreach/policy.ts';

// CI already provisions its own localhost database and applies the migrations.
const url = process.env.OUTREACH_TEST_DB_URL || (process.env.CI === 'true' ? process.env.DATABASE_URL : undefined);
test('Outreach PostgreSQL persistence and concurrency', {skip: !url}, async t => {
  const parsed = new URL(url!);
  assert.equal(parsed.hostname, '127.0.0.1');
  assert.ok(parsed.pathname === '/outreach_test' || (process.env.CI === 'true' && parsed.pathname === '/ci'));
  // Never permit this fixture against production.
  const db = new PrismaClient({datasources: {db: {url}}});
  const store = new OutreachStore(db);
  const now = new Date('2026-09-07T08:00:00Z');
  let n = 0;
  const candidate = (): Candidate => { const domain = `outreach-fixture-${++n}.com`; return {
    brand: 'Fixture', domain, email: `trade@${domain}`, sourceUrl: `https://${domain}/contact`,
    product: 'pet bowl', reason: 'test only', decision: 'DO', sourceVerified: true, subject: 'Wholesale enquiry', body: 'Hello team',
  }; };
  const clear = async () => { await db.outreachMessage.deleteMany(); await db.outreachContact.deleteMany(); };
  try {
    await t.test('concurrent intake and sending reserve exactly once', async () => {
      await clear(); const c = candidate();
      const rows = await Promise.all(Array.from({length: 8}, () => store.approve(c, 'test')));
      assert.equal(new Set(rows.map(r => r.id)).size, 1);
      let sent = 0;
      const mail: Mail = {verifyAccount: async () => ({from: 'support@furmosa.com', accountId: '1'}),
        search: async () => [], send: async () => ({messageId: String(++sent)})};
      const results = await Promise.all(rows.map(r => runContact(asContact(r), {store, mail, enabled: true, dryRun: false, now: () => now})));
      assert.equal(sent, 1); assert.equal(results.filter(r => r.status === 'sent').length, 1);
      assert.equal(await db.outreachMessage.count(), 1);
    });
    await t.test('global daily cap holds across different contacts and concurrent connections', async () => {
      await clear();
      const rows = await Promise.all(Array.from({length: 12}, () => store.approve(candidate(), 'test')));
      const claims = await Promise.all(rows.map(r => store.claim(asContact(r), 1, {subject: 'test', body: 'test'}, now)));
      assert.equal(claims.filter(Boolean).length, 5);
      assert.equal(await db.outreachMessage.count(), 5);
    });
    await t.test('unknown or interrupted send remains reserved across a new process/store', async () => {
      await clear(); const row = await store.approve(candidate(), 'test');
      const claim = await store.claim(asContact(row), 1, {subject: 'test', body: 'test'}, now);
      assert.ok(claim);
      const freshStore = new OutreachStore(db);
      assert.equal(await freshStore.claim(asContact(row), 1, {subject: 'test', body: 'test'}, now), null);
      await store.markUnknown(claim);
      assert.equal(await freshStore.claim(asContact(row), 1, {subject: 'test', body: 'test'}, now), null);
      assert.equal((await db.outreachMessage.findUniqueOrThrow({where: {id: claim.id}})).status, 'UNKNOWN');
    });
    await t.test('opt-out persists against repeated intake, stale claims and post-send updates', async () => {
      await clear(); const c = candidate(); const row = await store.approve(c, 'test');
      const claim = await store.claim(asContact(row), 1, {subject: 'test', body: 'test'}, now);
      assert.ok(claim); await store.optOut(row.id);
      assert.equal(await store.canSend(claim), false);
      assert.equal((await store.approve(c, 'test')).status, 'DO_NOT_CONTACT');
      await store.markSent(claim, '888', now, new Date('2026-09-14T08:00:00Z'));
      assert.equal((await db.outreachContact.findUniqueOrThrow({where: {id: row.id}})).status, 'DO_NOT_CONTACT');
    });
    await t.test('follow-up is due only after five weekdays and may be reserved once', async () => {
      await clear(); let row = await store.approve(candidate(), 'test');
      const claim = await store.claim(asContact(row), 1, {subject: 'test', body: 'test'}, now);
      assert.ok(claim); const due = new Date('2026-09-14T08:00:00Z');
      await store.markSent(claim, '999', now, due);
      row = await db.outreachContact.findUniqueOrThrow({where: {id: row.id}});
      assert.equal(await store.claim(asContact(row), 2, {subject: 'test', body: 'test'}, now), null);
      const claims = await Promise.all(Array.from({length: 8}, () => store.claim(asContact(row), 2, {subject: 'test', body: 'test'}, due)));
      assert.equal(claims.filter(Boolean).length, 1);
    });
    await t.test('reply wins over stale sender state and stops a reserved follow-up', async () => {
      await clear(); let row = await store.approve(candidate(), 'test');
      const claim = await store.claim(asContact(row), 1, {subject: 'test', body: 'test'}, now);
      assert.ok(claim); const due = new Date('2026-09-14T08:00:00Z');
      await store.markSent(claim, '1000', now, due);
      row = await db.outreachContact.findUniqueOrThrow({where: {id: row.id}});
      const follow = await store.claim(asContact(row), 2, {subject: 'test', body: 'test'}, due);
      assert.ok(follow);
      await store.stopForReply(row.id, {messageId: '1001', folderId: '1', fromAddress: row.email,
        toAddress: 'support@furmosa.com', subject: 'reply', receivedTime: due.getTime()});
      assert.equal(await store.canSend(follow), false);
      await store.cancelClaim(follow, 'REPLIED_BEFORE_SEND');
      assert.equal((await db.outreachContact.findUniqueOrThrow({where: {id: row.id}})).status, 'REPLIED');
    });
    await t.test('same email under a second domain cannot create a second contact', async () => {
      await clear(); const c = candidate(); const row = await store.approve(c, 'test');
      const other = {...candidate(), email: c.email};
      assert.equal((await store.approve(other, 'test')).id, row.id);
    });
  } finally { await clear(); await db.$disconnect(); }
});
