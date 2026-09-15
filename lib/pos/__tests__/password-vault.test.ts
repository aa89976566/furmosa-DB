import assert from 'node:assert/strict';
import { beforeEach, it } from 'node:test';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { encryptPosPassword, decryptPosPassword } from '../password-vault';
import { accessPosPassword } from '../password-vault-service';

beforeEach(() => { process.env.POS_PASSWORD_ENCRYPTION_KEY = randomBytes(32).toString('base64'); });
it('encrypts with randomized authenticated ciphertext bound to account and current password hash', () => {
  const encrypted = encryptPosPassword('test-only-password', 'u1', 'hash1');
  assert.equal(decryptPosPassword(encrypted, 'u1', 'hash1'), 'test-only-password');
  assert.notEqual(encrypted, encryptPosPassword('test-only-password', 'u1', 'hash1'));
  assert.ok(!encrypted.includes('test-only-password'));
  assert.throws(() => decryptPosPassword(encrypted, 'u2', 'hash1'));
  assert.throws(() => decryptPosPassword(encrypted, 'u1', 'reset-hash'));
  const parts = encrypted.split('.'); parts[3] = Buffer.from('tampered').toString('base64');
  assert.throws(() => decryptPosPassword(parts.join('.'), 'u1', 'hash1'));
  process.env.POS_PASSWORD_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  assert.throws(() => decryptPosPassword(encrypted, 'u1', 'hash1'));
});
it('fails closed without a dedicated encryption key', () => {
  delete process.env.POS_PASSWORD_ENCRYPTION_KEY;
  assert.throws(() => encryptPosPassword('password', 'u1', 'h'), /尚未設定/);
});

async function fixture(role = 'admin') {
  const user = { id: 'u1', merchantId: 'm1', passwordHash: await hash('test-only-password', 4), encryptedPassword: null as string | null };
  const logs: unknown[] = [];
  let accountReads = 0;
  let race = false;
  let failAudit = false;
  const db = {
    user: { findUnique: async ({ where }: any) => where.id === 'admin1' ? { id: 'admin1', role } : null },
    merchantUser: {
      findFirst: async ({ where }: any) => { accountReads++; return where.id === user.id && where.merchantId === user.merchantId ? { ...user } : null; },
      updateMany: async ({ where, data }: any) => { if (race || where.passwordHash !== user.passwordHash) return { count: 0 }; Object.assign(user, data); return { count: 1 }; },
    },
    posPasswordAccessLog: { create: async ({ data }: any) => { if (failAudit) throw new Error('audit unavailable'); logs.push(data); } },
    $transaction: async (fn: any) => { const old = { ...user }; try { return await fn(db); } catch (e) { Object.assign(user, old); throw e; } },
  };
  return { db: db as unknown as PrismaClient, user, logs, reads: () => accountReads, race: () => { race = true; }, failAudit: () => { failAudit = true; } };
}
const session = { userId: 'admin1' };
const target = { merchantId: 'm1', userId: 'u1' };
it('checks current database role before reading any credential, including stale admin sessions', async () => {
  for (const role of ['staff', 'finance', 'warehouse']) {
    const f = await fixture(role);
    await assert.rejects(accessPosPassword(f.db, session, target), /只有管理員/);
    assert.equal(f.reads(), 0);
  }
  const f = await fixture();
  for (const s of [null, { userId: 'deleted-admin' }]) await assert.rejects(accessPosPassword(f.db, s, target), /只有管理員/);
  assert.equal(f.reads(), 0);
});
it('rejects mismatched merchant and wrong passwords without a write', async () => {
  const f = await fixture();
  await assert.rejects(accessPosPassword(f.db, session, { ...target, merchantId: 'other' }), /不屬於/);
  await assert.rejects(accessPosPassword(f.db, session, { ...target, password: 'wrong-password' }), /不正確/);
  assert.equal(f.user.encryptedPassword, null); assert.equal(f.logs.length, 0);
});
it('saves an existing verified password without changing its login hash; reveals only with metadata audit', async () => {
  const f = await fixture(); const originalHash = f.user.passwordHash;
  assert.deepEqual(await accessPosPassword(f.db, session, target), { status: 'missing' });
  assert.deepEqual(await accessPosPassword(f.db, session, { ...target, password: 'test-only-password' }), { status: 'saved' });
  assert.equal(f.user.passwordHash, originalHash);
  assert.deepEqual(await accessPosPassword(f.db, session, target), { status: 'revealed', password: 'test-only-password' });
  assert.deepEqual(f.logs, [
    { adminId: 'admin1', merchantUserId: 'u1', action: 'save' },
    { adminId: 'admin1', merchantUserId: 'u1', action: 'reveal' },
  ]);
  f.user.passwordHash = await hash('reset-password', 4);
  await assert.rejects(accessPosPassword(f.db, session, target));
});
it('rejects a concurrent reset and rolls back storage if audit fails', async () => {
  const f = await fixture(); f.race();
  await assert.rejects(accessPosPassword(f.db, session, { ...target, password: 'test-only-password' }), /已變更/);
  assert.equal(f.user.encryptedPassword, null);
  const g = await fixture(); g.failAudit();
  await assert.rejects(accessPosPassword(g.db, session, { ...target, password: 'test-only-password' }));
  assert.equal(g.user.encryptedPassword, null);
});
it('never reveals a password if its audit cannot be recorded', async () => {
  const f = await fixture();
  await accessPosPassword(f.db, session, { ...target, password: 'test-only-password' });
  f.failAudit();
  await assert.rejects(accessPosPassword(f.db, session, target));
});
