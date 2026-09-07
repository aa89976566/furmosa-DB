import { COMPANY_EMAIL, followUpBody, followUpDueAt, mayFollowUp, trackingMarker,
  type ContactState, type Candidate } from './policy.ts';
import type { MailMessage } from './zoho.ts';

export type Contact = ContactState & Candidate & {
  id: string; key: string; firstMessageId: string | null;
};
export type Claim = {id: string; contactId: string; sequence: 1 | 2; subject: string; body: string};
export interface Store {
  /** Atomically re-check contact state, reserve the daily cap, and persist SENDING before returning.
   * Unique (contactId, sequence); SENDING/UNKNOWN can never be claimed again. */
  claim(contact: Contact, sequence: 1 | 2, message: {subject: string; body: string}, now: Date): Promise<Claim | null>;
  markSent(claim: Claim, messageId: string, sentAt: Date, dueAt: Date | null): Promise<void>;
  markUnknown(claim: Claim): Promise<void>;
  stopForReply(contactId: string, message: MailMessage): Promise<void>;
  block(contactId: string, reason: string): Promise<void>;
  cancelClaim(claim: Claim, reason: string): Promise<void>;
  canSend(claim: Claim): Promise<boolean>;
}
export interface Mail {
  verifyAccount(): Promise<{accountId: string; from: string}>;
  search(key: string): Promise<MailMessage[]>;
  send(input: {to: string; subject: string; body: string; replyToMessageId?: string}): Promise<{messageId: string}>;
}
export type RunResult = {status: 'skipped' | 'blocked' | 'would_send' | 'sent' | 'replied' | 'unknown'; reason?: string; sequence?: 1 | 2};

function addresses(value: string): string[] {
  return value.toLowerCase().replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}/g) || [];
}
function fromCompany(m: MailMessage): boolean { return addresses(m.fromAddress).includes(COMPANY_EMAIL); }
function fromContact(m: MailMessage, c: Contact): boolean {
  return addresses(m.fromAddress).some(e => e === c.email || e.endsWith(`@${c.domain}`) || e.split('@')[1]?.endsWith(`.${c.domain}`));
}

export async function conversation(mail: Mail, contact: Contact): Promise<MailMessage[]> {
  // Domain searches also catch a different colleague from the same brand.
  const results = await Promise.all([
    mail.search(`from:${contact.domain}`), mail.search(`to:${contact.domain}`),
    mail.search(`from:${contact.email}`), mail.search(`to:${contact.email}`),
    mail.search(`subject:${trackingMarker(contact.key)}`),
  ]);
  const unique = new Map<string, MailMessage>();
  for (const m of results.flat()) unique.set(m.messageId, m);
  return [...unique.values()].sort((a, b) => b.receivedTime - a.receivedTime);
}

function incomingReply(messages: MailMessage[], contact: Contact): MailMessage | undefined {
  if (!contact.firstSentAt) return undefined;
  const marker = trackingMarker(contact.key);
  // Any relevant inbound response, including automatic replies, stops automated follow-ups.
  return messages.find(m => !fromCompany(m) && m.receivedTime >= contact.firstSentAt!.getTime()
    && (fromContact(m, contact) || m.subject.includes(marker)));
}

export async function runContact(
  contact: Contact, deps: {mail: Mail; store: Store; enabled: boolean; dryRun: boolean; now?: () => Date},
): Promise<RunResult> {
  const clock = deps.now || (() => new Date());
  const now = clock();
  const {mail, store} = deps;
  if (contact.doNotContact || contact.replyMessageId || !['APPROVED', 'WAITING'].includes(contact.status))
    return {status: 'skipped', reason: 'STOPPED'};
  const verified = await mail.verifyAccount();
  if (verified.from !== COMPANY_EMAIL) throw new Error('COMPANY_SENDER_MISMATCH');
  const history = await conversation(mail, contact);
  const reply = incomingReply(history, contact);
  if (reply) {
    if (!deps.dryRun) await store.stopForReply(contact.id, reply);
    return {status: 'replied'};
  }
  let sequence: 1 | 2;
  if (contact.status === 'APPROVED' && !contact.firstSentAt) {
    // Existing company correspondence requires review; even older contacts are not cold-started blindly.
    const existing = history.some(m => fromCompany(m) || fromContact(m, contact));
    if (existing) {
      if (!deps.dryRun) await store.block(contact.id, 'EXISTING_CORRESPONDENCE');
      return {status: 'blocked', reason: 'EXISTING_CORRESPONDENCE'};
    }
    sequence = 1;
  } else if (mayFollowUp(contact, now) && contact.firstMessageId) {
    sequence = 2;
  } else return {status: 'skipped', reason: 'NOT_DUE'};
  const marker = trackingMarker(contact.key);
  const subject = `${sequence === 2 ? 'Re: ' : ''}${contact.subject} [${marker}]`;
  if (subject.length > 200) return {status: 'blocked', reason: 'SUBJECT_TOO_LONG'};
  const body = sequence === 1 ? contact.body : followUpBody(contact.brand, contact.product);
  if (deps.dryRun || !deps.enabled) return {status: 'would_send', sequence};
  const claim = await store.claim(contact, sequence, {subject, body}, now);
  if (!claim) return {status: 'skipped', reason: 'ALREADY_CLAIMED_OR_DAILY_LIMIT'};
  try {
    // Check again after reserving the job. Failure cancels this attempt without sending.
    const fresh = await conversation(mail, contact);
    const lastReply = incomingReply(fresh, contact);
    if (lastReply) {
      await store.stopForReply(contact.id, lastReply);
      await store.cancelClaim(claim, 'REPLIED_BEFORE_SEND');
      return {status: 'replied'};
    }
    if (sequence === 1 && fresh.some(m => fromCompany(m) || fromContact(m, contact))) {
      await store.block(contact.id, 'EXISTING_CORRESPONDENCE');
      await store.cancelClaim(claim, 'EXISTING_CORRESPONDENCE');
      return {status: 'blocked', reason: 'EXISTING_CORRESPONDENCE'};
    }
  } catch {
    await store.cancelClaim(claim, 'PRE_SEND_READ_FAILED');
    return {status: 'blocked', reason: 'PRE_SEND_READ_FAILED'};
  }
  try {
    if (!await store.canSend(claim)) {
      await store.cancelClaim(claim, 'CONTACT_STOPPED');
      return {status: 'skipped', reason: 'CONTACT_STOPPED'};
    }
    const result = await mail.send({to: contact.email, subject, body,
      ...(sequence === 2 ? {replyToMessageId: contact.firstMessageId!} : {})});
    const sentAt = clock();
    // A DB failure here is also ambiguous: the durable SENDING claim must not be retried.
    await store.markSent(claim, result.messageId, sentAt, sequence === 1 ? followUpDueAt(sentAt) : null);
    return {status: 'sent', sequence};
  } catch {
    // If this persistence call fails too, SENDING remains non-retryable by contract.
    await store.markUnknown(claim);
    return {status: 'unknown', reason: 'RECONCILIATION_REQUIRED', sequence};
  }
}
