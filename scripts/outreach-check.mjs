// Run on the Railway service with its existing environment. Never print credentials.
import {PrismaClient} from '@prisma/client';
import {ZohoMail} from '../lib/outreach/zoho.ts';
const db = new PrismaClient({log: []});
try {
  const mail = new ZohoMail();
  await mail.verifyAccount();
  const contacts = await db.outreachContact.count();
  const messages = await db.outreachMessage.count();
  const rls = await db.$queryRaw`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('outreach_contacts', 'outreach_messages')`;
  if (rls.length !== 2 || rls.some(r => !r.rowsecurity)) throw new Error('RLS_NOT_ENABLED');
  console.log('OUTREACH_STORAGE_AND_MAILBOX_OK', JSON.stringify({contacts, messages}));
  if (process.argv.includes('--send-test')) {
    const subject = `Furmosa Outreach verification ${new Date().toISOString()}`;
    const first = await mail.send({to: 'support@furmosa.com', subject,
      body: 'Internal Furmosa test: Zoho company sender and reply API verification. No supplier outreach.'});
    const reply = await mail.send({to: 'support@furmosa.com', subject: `Re: ${subject}`,
      body: 'Internal verification reply. This tests the single follow-up API path.', replyToMessageId: first.messageId});
    let matched = [];
    for (let i = 0; i < 5; i++) {
      matched = await mail.search(`subject:${subject}`);
      if (matched.some(m => m.messageId === first.messageId) && matched.some(m => m.messageId === reply.messageId)) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!matched.some(m => m.messageId === first.messageId) || !matched.some(m => m.messageId === reply.messageId))
      throw new Error('SENT_MESSAGES_NOT_YET_VISIBLE');
    console.log('OUTREACH_SEND_AND_REPLY_OK', JSON.stringify({subject, matches: matched.length}));
  }
} catch { console.error('OUTREACH_CHECK_FAILED'); process.exitCode = 1; }
finally { await db.$disconnect(); }
