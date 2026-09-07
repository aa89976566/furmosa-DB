import { Prisma, type PrismaClient, type OutreachContact } from '@prisma/client';
import { contactKey, localDay, MAX_FIRST_CONTACTS_PER_DAY, mayFollowUp, validateCandidate, type Candidate } from './policy.ts';
import type { Claim, Contact, Store } from './runner.ts';
import type { MailMessage } from './zoho.ts';

export function asContact(row: OutreachContact): Contact {
  if (!['APPROVED', 'WAITING', 'REPLIED', 'DO_NOT_CONTACT', 'BLOCKED', 'COMPLETE'].includes(row.status))
    throw new Error('INVALID_CONTACT_STATE');
  return {...row, status: row.status as Contact['status'], decision: 'DO', sourceVerified: true};
}

/** Every writer uses the same transaction lock. No lock is held across a Zoho request. */
export class OutreachStore implements Store {
  constructor(private db: PrismaClient) {}
  private transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(648219, 1)`;
      return fn(tx);
    }, {isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 15000});
  }
  async approve(input: Candidate, createdBy: string): Promise<OutreachContact> {
    const c = validateCandidate(input);
    return this.transaction(async tx => {
      const existing = await tx.outreachContact.findFirst({where: {OR: [{domain: c.domain}, {email: c.email}]}});
      if (existing) return existing; // Repeated intake cannot reset a stop or overwrite sent content.
      return tx.outreachContact.create({data: {key: contactKey(c.domain), domain: c.domain, email: c.email,
        brand: c.brand, sourceUrl: c.sourceUrl, product: c.product, reason: c.reason,
        subject: c.subject, body: c.body, createdBy}});
    });
  }
  async claim(contact: Contact, sequence: 1 | 2, message: {subject: string; body: string}, now: Date): Promise<Claim | null> {
    return this.transaction(async tx => {
      const row = await tx.outreachContact.findUnique({where: {id: contact.id}});
      if (!row || row.doNotContact || row.replyMessageId) return null;
      if (sequence === 1 ? row.status !== 'APPROVED' || !!row.firstSentAt : !mayFollowUp(asContact(row), now)) return null;
      if (await tx.outreachMessage.findUnique({where: {contactId_sequence: {contactId: row.id, sequence}}})) return null;
      const reservedDay = localDay(now);
      const count = await tx.outreachMessage.count({where: {reservedDay, sequence,
        status: {in: ['SENDING', 'SENT', 'UNKNOWN']}}});
      if (count >= MAX_FIRST_CONTACTS_PER_DAY) return null;
      return {...await tx.outreachMessage.create({data: {contactId: row.id, sequence, ...message, reservedDay}}), sequence};
    });
  }
  async markSent(claim: Claim, messageId: string, sentAt: Date, dueAt: Date | null): Promise<void> {
    await this.transaction(async tx => {
      const changed = await tx.outreachMessage.updateMany({where: {id: claim.id, status: 'SENDING'},
        data: {status: 'SENT', zohoMessageId: messageId, sentAt}});
      if (changed.count !== 1) throw new Error('CLAIM_NOT_SENDING');
      await tx.outreachContact.update({where: {id: claim.contactId}, data: claim.sequence === 1
        ? {firstMessageId: messageId, firstSentAt: sentAt, followUpDueAt: dueAt}
        : {followUpSentAt: sentAt}});
      // A concurrent opt-out or reply always wins over the post-send state update.
      await tx.outreachContact.updateMany({where: {id: claim.contactId, status: {in: ['APPROVED', 'WAITING']},
        doNotContact: false, replyMessageId: null}, data: {status: 'WAITING'}});
    });
  }
  async markUnknown(claim: Claim): Promise<void> {
    await this.transaction(async tx => {
      await tx.outreachMessage.updateMany({where: {id: claim.id, status: 'SENDING'},
        data: {status: 'UNKNOWN', errorCode: 'RECONCILIATION_REQUIRED'}});
      await tx.outreachContact.updateMany({where: {id: claim.contactId, status: {in: ['APPROVED', 'WAITING']}},
        data: {status: 'BLOCKED', stopReason: 'RECONCILIATION_REQUIRED'}});
    });
  }
  async stopForReply(contactId: string, message: MailMessage): Promise<void> {
    await this.transaction(async tx => {
      await tx.outreachContact.updateMany({where: {id: contactId, doNotContact: false, replyMessageId: null},
        data: {status: 'REPLIED', replyMessageId: message.messageId, replyFolderId: message.folderId,
          stopReason: 'REPLY_RECEIVED'}});
    });
  }
  async block(contactId: string, reason: string): Promise<void> {
    await this.transaction(async tx => {
      await tx.outreachContact.updateMany({where: {id: contactId, status: {in: ['APPROVED', 'WAITING']}},
        data: {status: 'BLOCKED', stopReason: reason}});
    });
  }
  async cancelClaim(claim: Claim, reason: string): Promise<void> {
    await this.transaction(async tx => {
      await tx.outreachMessage.updateMany({where: {id: claim.id, status: 'SENDING'},
        data: {status: 'CANCELLED', errorCode: reason}});
      await tx.outreachContact.updateMany({where: {id: claim.contactId, status: {in: ['APPROVED', 'WAITING']}},
        data: {status: 'BLOCKED', stopReason: reason}});
    });
  }
  async canSend(claim: Claim): Promise<boolean> {
    return this.transaction(async tx => {
      const row = await tx.outreachContact.findUnique({where: {id: claim.contactId}});
      const attempt = await tx.outreachMessage.findUnique({where: {id: claim.id}});
      return !!row && !row.doNotContact && !row.replyMessageId && ['APPROVED', 'WAITING'].includes(row.status)
        && attempt?.status === 'SENDING';
    });
  }
  async optOut(contactId: string): Promise<void> {
    await this.transaction(async tx => {
      await tx.outreachContact.update({where: {id: contactId}, data: {doNotContact: true,
        status: 'DO_NOT_CONTACT', stopReason: 'MANUAL_STOP'}});
    });
  }
}
