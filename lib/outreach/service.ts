import { prisma } from '../prisma';
import { OutreachStore, asContact } from './store';
import { runContact, conversation } from './runner';
import { ZohoMail } from './zoho';
import { summarizeReply } from './summary';

export const outreachStore = new OutreachStore(prisma);
export function sendingEnabled(): boolean {
  return process.env.OUTREACH_SEND_ENABLED === 'true' && process.env.RAILWAY_ENVIRONMENT_NAME === 'production';
}
export async function runOutreach(dryRun = true) {
  const mail = new ZohoMail();
  await mail.verifyAccount();
  const now = new Date();
  // Least recently checked first: a quiet older brand cannot starve later candidates.
  const contacts = await prisma.outreachContact.findMany({where: {status: {in: ['APPROVED', 'WAITING']},
    doNotContact: false, OR: [{checkedAt: null}, {checkedAt: {lt: new Date(now.getTime() - 3600000)}}]},
    orderBy: [{checkedAt: {sort: 'asc', nulls: 'first'}}, {createdAt: 'asc'}], take: 10});
  const results: {id: string; status: string; reason?: string}[] = [];
  for (const row of contacts) {
    try {
      const result = await runContact(asContact(row), {mail, store: outreachStore, enabled: sendingEnabled(), dryRun});
      results.push({id: row.id, ...result});
    } catch { results.push({id: row.id, status: 'error', reason: 'READ_OR_STORAGE_FAILED'}); }
    if (!dryRun) await prisma.outreachContact.update({where: {id: row.id}, data: {checkedAt: now}});
  }
  if (!dryRun) {
    const replied = await prisma.outreachContact.findMany({where: {status: 'REPLIED', replySummary: null}, take: 5});
    for (const row of replied) {
      try {
        const messages = await conversation(mail, asContact(row));
        const inbound = messages.filter(m => !m.fromAddress.toLowerCase().includes('support@furmosa.com')
          && m.receivedTime >= (row.firstSentAt?.getTime() || 0));
        if (!inbound.length || inbound.length > 30) continue;
        const content: string[] = [];
        for (const m of inbound) content.push(await mail.content(m));
        await prisma.outreachContact.update({where: {id: row.id}, data: {replySummary: summarizeReply(content)}});
      } catch { /* Keep summary pending. A content-read failure never re-enables follow-up. */ }
    }
  }
  return {dryRun, sendingEnabled: sendingEnabled(), checked: results.length, results};
}

/** Only the explicitly enabled, persistent Railway production process starts this timer. */
export function startOutreachWorker() {
  if (process.env.OUTREACH_WORKER_ENABLED !== 'true' || process.env.RAILWAY_ENVIRONMENT_NAME !== 'production') return;
  const state = globalThis as typeof globalThis & {outreachTimer?: ReturnType<typeof setInterval>; outreachBusy?: boolean};
  if (state.outreachTimer) return;
  const tick = async () => {
    if (state.outreachBusy) return;
    state.outreachBusy = true;
    try {
      const result = await runOutreach(false);
      console.info('OUTREACH_RUN', JSON.stringify({checked: result.checked,
        sent: result.results.filter(r => r.status === 'sent').length,
        errors: result.results.filter(r => ['error', 'unknown'].includes(r.status)).length}));
    } catch { console.error('OUTREACH_RUN_FAILED'); }
    finally { state.outreachBusy = false; }
  };
  state.outreachTimer = setInterval(tick, 15 * 60 * 1000);
  state.outreachTimer.unref();
  setTimeout(tick, 30000).unref();
}
