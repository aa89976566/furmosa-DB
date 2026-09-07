import { createHash } from 'node:crypto';

export const COMPANY_EMAIL = 'support@furmosa.com';
export const OUTREACH_TIME_ZONE = 'Europe/Madrid';
export const MAX_FIRST_CONTACTS_PER_DAY = 5;
export const MAX_FOLLOW_UPS = 1;

export type Candidate = {
  brand: string; domain: string; email: string; sourceUrl: string;
  product: string; reason: string; decision: 'DO';
  subject: string; body: string; sourceVerified: true;
};

export function normalizeDomain(input: string): string {
  const url = new URL(input.includes('://') ? input : `https://${input}`);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
    || /(?:^|\.)(?:localhost|local|internal|test|example|invalid)$/.test(host))
    throw new Error('INVALID_BRAND_DOMAIN');
  return host;
}

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(email)
    || email.split('@').length !== 2 || email.startsWith('.') || email.includes('..'))
    throw new Error('INVALID_EMAIL');
  return email;
}

export function validateCandidate(input: Candidate): Candidate {
  if (input.decision !== 'DO' || input.sourceVerified !== true)
    throw new Error('CANDIDATE_NOT_APPROVED');
  const domain = normalizeDomain(input.domain);
  const email = normalizeEmail(input.email);
  const source = new URL(input.sourceUrl);
  const sourceHost = normalizeDomain(source.origin);
  if (sourceHost !== domain && !sourceHost.endsWith(`.${domain}`))
    throw new Error('OFFICIAL_SOURCE_REQUIRED');
  if (source.username || source.password || source.protocol !== 'https:')
    throw new Error('OFFICIAL_SOURCE_REQUIRED');
  if (/^(?:no-?reply|mailer-daemon|postmaster|do-?not-?reply)@/.test(email)
    || email === COMPANY_EMAIL) throw new Error('UNSUITABLE_RECIPIENT');
  for (const [name, limit] of [['brand', 120], ['product', 500], ['reason', 2000],
    ['subject', 160], ['body', 12000]] as const) {
    if (typeof input[name] !== 'string' || !input[name].trim() || input[name].length > limit)
      throw new Error(`INVALID_${name.toUpperCase()}`);
  }
  if (/[\r\n]/.test(input.subject)) throw new Error('INVALID_SUBJECT');
  return {...input, domain, email, sourceUrl: source.href};
}

export function contactKey(domain: string): string {
  return createHash('sha256').update(normalizeDomain(domain)).digest('hex');
}

type ClockParts = {year: number; month: number; day: number; hour: number; minute: number; second: number};
function parts(date: Date, timeZone: string): ClockParts {
  if (!Number.isFinite(date.getTime())) throw new Error('INVALID_DATE');
  const values = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(values.filter(p => p.type !== 'literal')
    .map(p => [p.type, Number(p.value)])) as ClockParts;
}
function wallClockMillis(p: ClockParts): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
export function localDay(date: Date, timeZone = OUTREACH_TIME_ZONE): string {
  const p = parts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Five full weekdays, preserving local clock time across DST; public holidays are not excluded. */
export function followUpDueAt(sentAt: Date, timeZone = OUTREACH_TIME_ZONE): Date {
  const start = parts(sentAt, timeZone);
  const calendar = new Date(Date.UTC(start.year, start.month - 1, start.day));
  for (let n = 0; n < 5;) {
    calendar.setUTCDate(calendar.getUTCDate() + 1);
    if (calendar.getUTCDay() !== 0 && calendar.getUTCDay() !== 6) n++;
  }
  const target = wallClockMillis({...start, year: calendar.getUTCFullYear(),
    month: calendar.getUTCMonth() + 1, day: calendar.getUTCDate()});
  let instant = target;
  for (let i = 0; i < 4; i++) instant += target - wallClockMillis(parts(new Date(instant), timeZone));
  if (wallClockMillis(parts(new Date(instant), timeZone)) !== target)
    throw new Error('AMBIGUOUS_FOLLOW_UP_TIME');
  return new Date(instant + sentAt.getUTCMilliseconds());
}

export type ContactState = {
  status: 'APPROVED' | 'WAITING' | 'REPLIED' | 'DO_NOT_CONTACT' | 'BLOCKED' | 'COMPLETE';
  firstSentAt: Date | null; followUpSentAt: Date | null; replyMessageId: string | null;
  followUpDueAt: Date | null; doNotContact: boolean;
};
export function mayFollowUp(contact: ContactState, now: Date): boolean {
  return contact.status === 'WAITING' && !contact.doNotContact && !contact.replyMessageId
    && !!contact.firstSentAt && !contact.followUpSentAt && !!contact.followUpDueAt
    && now.getTime() >= contact.followUpDueAt.getTime();
}

export function trackingMarker(key: string): string {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('INVALID_CONTACT_KEY');
  return `FURMOSA-${key.slice(0, 16)}`;
}

export function followUpBody(brand: string, product: string): string {
  return `Hello ${brand} team,\n\nI am following up on Furmosa's enquiry about ${product} for Taiwan. Could you let us know whether wholesale cooperation is available and share your MOQ and price list?\n\nIf this is not relevant, please let us know and we will not follow up again.\n\nThank you,\nFurmosa\nsupport@furmosa.com`;
}
