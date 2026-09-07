import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANY_EMAIL, contactKey, followUpDueAt, localDay, validateCandidate } from '../outreach/policy.ts';
import { runContact, type Contact, type Store, type Mail, type Claim } from '../outreach/runner.ts';
import { ZohoMail, ZohoError, type MailMessage } from '../outreach/zoho.ts';

const now = new Date('2026-09-07T08:00:00Z');
const sample: Contact = {id: 'contact-1', key: contactKey('brandpet.com'),
  brand: 'Brand Pet', domain: 'brandpet.com', email: 'trade@brandpet.com',
  sourceUrl: 'https://brandpet.com/wholesale', product: 'washable dog beds',
  reason: 'Approved MVP candidate', decision: 'DO', sourceVerified: true,
  subject: 'Wholesale enquiry for Taiwan', body: 'Hello Brand Pet team,\nWe are Furmosa.',
  status: 'APPROVED', firstSentAt: null, followUpSentAt: null, replyMessageId: null,
  followUpDueAt: null, firstMessageId: null, doNotContact: false};
const message: MailMessage = {messageId: '1788787504020004400', folderId: '300',
  fromAddress: 'trade@brandpet.com', toAddress: COMPANY_EMAIL,
  subject: 'Re: Wholesale enquiry', receivedTime: now.getTime()};
function fixture(contact = {...sample}) {
  const events: string[] = []; let claimed = false;
  const store: Store = {
    async claim(c, sequence, body) {
      if (claimed) return null;
      claimed = true; events.push('claim');
      return {id: 'job-1', contactId: c.id, sequence, ...body};
    },
    async markSent() { events.push('sent'); }, async markUnknown() { events.push('unknown'); },
    async stopForReply() { events.push('replied'); }, async block() { events.push('blocked'); },
    async cancelClaim() { events.push('cancelled'); },
    async canSend() { return true; },
  };
  const mail: Mail = {async verifyAccount() { return {accountId: '123', from: COMPANY_EMAIL}; },
    async search() { return []; }, async send() { events.push('network-send'); return {messageId: '555'}; }};
  return {contact, events, store, mail, deps: {mail, store, enabled: true, dryRun: false, now: () => now}};
}

test('five weekdays preserve Madrid clock time across spring and autumn DST', () => {
  assert.equal(followUpDueAt(new Date('2026-03-27T09:30:00Z')).toISOString(), '2026-04-03T08:30:00.000Z');
  assert.equal(followUpDueAt(new Date('2026-10-23T08:30:00Z')).toISOString(), '2026-10-30T09:30:00.000Z');
  assert.equal(followUpDueAt(new Date('2026-09-07T08:30:00Z')).toISOString(), '2026-09-14T08:30:00.000Z');
  assert.equal(localDay(new Date('2026-09-07T23:00:00Z')), '2026-09-08');
});
test('only approved candidates with official source and one valid business recipient pass', () => {
  assert.equal(validateCandidate({...sample, domain: 'WWW.BRANDPET.COM'}).domain, 'brandpet.com');
  assert.throws(() => validateCandidate({...sample, sourceUrl: 'https://brandpet.com.attacker.net/'}), /OFFICIAL/);
  assert.throws(() => validateCandidate({...sample, email: 'a@brandpet.com,b@brandpet.com'}), /INVALID_EMAIL/);
  assert.throws(() => validateCandidate({...sample, email: 'noreply@brandpet.com'}), /UNSUITABLE/);
  assert.throws(() => validateCandidate({...sample, subject: 'Subject\r\nBcc: other@evil.com'}), /INVALID_SUBJECT/);
  assert.throws(() => validateCandidate({...sample, sourceVerified: false as true}), /NOT_APPROVED/);
});
test('dry run performs no writes or sends; disabled sending reports would-send', async () => {
  const f = fixture(); f.deps.dryRun = true;
  assert.equal((await runContact(f.contact, f.deps)).status, 'would_send');
  assert.deepEqual(f.events, []);
  f.deps.dryRun = false; f.deps.enabled = false;
  assert.equal((await runContact(f.contact, f.deps)).status, 'would_send');
  assert.deepEqual(f.events, []);
});
test('concurrent runs send only once when the store atomically reserves the unique job', async () => {
  const f = fixture();
  await Promise.all([runContact(f.contact, f.deps), runContact(f.contact, f.deps)]);
  assert.deepEqual(f.events, ['claim', 'network-send', 'sent']);
});
test('existing company correspondence blocks a new cold outreach', async () => {
  const f = fixture(); f.mail.search = async () => [{...message, fromAddress: COMPANY_EMAIL}];
  assert.equal((await runContact(f.contact, f.deps)).status, 'blocked');
  assert.deepEqual(f.events, ['blocked']);
});
function waiting(): Contact {
  return {...sample, status: 'WAITING', firstSentAt: new Date('2026-08-31T08:00:00Z'),
    firstMessageId: '333', followUpDueAt: now};
}
test('a reply from another colleague at the brand stops follow-up', async () => {
  const f = fixture(waiting());
  f.mail.search = async () => [{...message, fromAddress: 'sales@brandpet.com'}];
  assert.equal((await runContact(f.contact, f.deps)).status, 'replied');
  assert.deepEqual(f.events, ['replied']);
});
test('a reply that arrives after reservation cancels the send', async () => {
  const f = fixture(waiting()); let reads = 0;
  f.mail.search = async () => ++reads > 5 ? [message] : [];
  assert.equal((await runContact(f.contact, f.deps)).status, 'replied');
  assert.deepEqual(f.events, ['claim', 'replied', 'cancelled']);
});
test('follow-up is not early, uses original message ID, and never follows up twice', async () => {
  const f = fixture(waiting()); f.deps.now = () => new Date(now.getTime() - 1);
  assert.equal((await runContact(f.contact, f.deps)).status, 'skipped');
  f.deps.now = () => now;
  f.mail.send = async input => { assert.equal(input.replyToMessageId, '333'); return {messageId: '777'}; };
  assert.deepEqual(await runContact(f.contact, f.deps), {status: 'sent', sequence: 2});
  f.contact.followUpSentAt = now;
  assert.equal((await runContact(f.contact, f.deps)).status, 'skipped');
});
test('refusals and stopped contacts cannot send', async () => {
  for (const change of [{doNotContact: true}, {replyMessageId: '444'}, {status: 'BLOCKED' as const}]) {
    const f = fixture({...sample, ...change});
    assert.equal((await runContact(f.contact, f.deps)).status, 'skipped');
    assert.deepEqual(f.events, []);
  }
});
test('send timeouts and post-send persistence failures become unknown and are not retried', async () => {
  for (const failAt of ['send', 'save']) {
    const f = fixture();
    if (failAt === 'send') f.mail.send = async () => {f.events.push('network-send'); throw new Error('timeout');};
    else f.store.markSent = async () => {throw new Error('DB down');};
    assert.equal((await runContact(f.contact, f.deps)).status, 'unknown');
    await runContact(f.contact, f.deps);
    assert.equal(f.events.filter(e => e === 'network-send').length, 1);
    assert.ok(f.events.includes('unknown'));
  }
});
test('history read failures never send or get interpreted as an empty inbox', async () => {
  const f = fixture(); f.mail.search = async () => {throw new Error('read failed');};
  await assert.rejects(runContact(f.contact, f.deps));
  assert.deepEqual(f.events, []);
});

const env = {ZOHO_CLIENT_ID: 'client', ZOHO_CLIENT_SECRET: 'never-log-client-secret',
  ZOHO_REFRESH_TOKEN: 'never-log-refresh-token', ZOHO_ACCOUNT_ID: '123', ZOHO_FROM_EMAIL: COMPANY_EMAIL};
const ok = (data: unknown) => new Response(JSON.stringify({status: {code: 200}, data}));
test('Zoho accepts the real company mailbox even when primary login is Gmail; tokens stay in POST body', async () => {
  const calls: string[] = [];
  const mail = new ZohoMail(env, async (url, init) => {
    calls.push(url);
    assert.ok(!url.includes(env.ZOHO_CLIENT_SECRET));
    if (url.includes('/oauth/')) {
      assert.equal(init?.method, 'POST'); assert.equal(init?.redirect, 'error');
      assert.equal((init?.body as URLSearchParams).get('refresh_token'), env.ZOHO_REFRESH_TOKEN);
      return new Response(JSON.stringify({access_token: 'private-access', expires_in: 3600}));
    }
    return ok([{accountId: '123', mailboxAddress: COMPANY_EMAIL, primaryEmailAddress: 'owner@gmail.com'}]);
  });
  await Promise.all([mail.verifyAccount(), mail.verifyAccount()]);
  assert.equal(calls.filter(c => c.includes('/oauth/')).length, 1);
});
test('Zoho rejects wrong sender and redacts secrets from thrown errors', async () => {
  assert.throws(() => new ZohoMail({...env, ZOHO_FROM_EMAIL: 'owner@gmail.com'}), /MISMATCH/);
  const mail = new ZohoMail(env, async () => {throw new Error(env.ZOHO_CLIENT_SECRET);});
  await assert.rejects(mail.verifyAccount(), e => e instanceof ZohoError && e.message === 'TOKEN_REFRESH_FAILED');
});
test('Zoho refuses incomplete search results instead of asserting no replies', async () => {
  let reads = 0;
  const mail = new ZohoMail(env, async url => {
    if (url.includes('/oauth/')) return new Response(JSON.stringify({access_token: 'private', expires_in: 3600}));
    reads++;
    return ok(Array.from({length: 200}, (_, i) => ({messageId: String(reads * 1000 + i), folderId: '3',
      fromAddress: 'trade@brandpet.com', receivedtime: now.getTime()})));
  });
  await assert.rejects(mail.search('from:brandpet.com'), /SEARCH_TOO_LARGE/);
  assert.equal(reads, 10);
});
test('Zoho send errors are never automatically retried and payload cannot override the sender', async () => {
  let sends = 0;
  const mail = new ZohoMail(env, async (url, init) => {
    if (url.includes('/oauth/')) return new Response(JSON.stringify({access_token: 'private', expires_in: 3600}));
    sends++;
    assert.equal(JSON.parse(String(init?.body)).fromAddress, COMPANY_EMAIL);
    throw new Error(env.ZOHO_REFRESH_TOKEN);
  });
  await assert.rejects(mail.send({to: 'trade@brandpet.com', subject: 'Hello', body: 'Hello'}),
    e => e instanceof ZohoError && e.uncertainSend && !e.message.includes(env.ZOHO_REFRESH_TOKEN));
  assert.equal(sends, 1);
});
