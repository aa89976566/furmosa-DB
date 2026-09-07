import { COMPANY_EMAIL, normalizeEmail } from './policy.ts';

export class ZohoError extends Error {
  readonly code: string;
  readonly uncertainSend: boolean;
  constructor(code: string, uncertainSend = false) {
    super(code); this.name = 'ZohoError'; this.code = code; this.uncertainSend = uncertainSend;
  }
}
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
type Env = Record<string, string | undefined>;
export type MailMessage = {
  messageId: string; folderId: string; fromAddress: string; toAddress: string;
  subject: string; receivedTime: number; threadId?: string;
};
type Json = Record<string, any>;
function id(value: unknown): string {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  throw new ZohoError('UNSAFE_MESSAGE_ID');
}
function mapMessage(m: Json): MailMessage {
  const receivedTime = Number(m.receivedTime ?? m.receivedtime ?? m.sentDateInGMT);
  if (!Number.isFinite(receivedTime) || receivedTime < 0) throw new ZohoError('INVALID_MESSAGE_TIME');
  return {messageId: id(m.messageId), folderId: id(m.folderId),
    fromAddress: String(m.fromAddress || ''), toAddress: String(m.toAddress || ''),
    subject: String(m.subject || ''), receivedTime,
    ...(m.threadId && String(m.threadId) !== '0' ? {threadId: id(m.threadId)} : {})};
}

/** EU-only, company-mailbox-only client. All network errors are redacted. No automatic send retries. */
export class ZohoMail {
  private env: Env;
  private fetcher: Fetch;
  private clock: () => Date;
  private token?: {value: string; expiresAt: number};
  private pending?: Promise<string>;
  constructor(env: Env = process.env, fetcher: Fetch = fetch, clock = () => new Date()) {
    for (const key of ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN',
      'ZOHO_ACCOUNT_ID', 'ZOHO_FROM_EMAIL']) if (!env[key]) throw new ZohoError(`MISSING_${key}`);
    if (env.ZOHO_FROM_EMAIL !== COMPANY_EMAIL) throw new ZohoError('COMPANY_SENDER_MISMATCH');
    id(env.ZOHO_ACCOUNT_ID);
    this.env = {...env}; this.fetcher = fetcher; this.clock = clock;
  }
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.clock().getTime()) return this.token.value;
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const r = await this.fetcher('https://accounts.zoho.eu/oauth/v2/token', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
          body: new URLSearchParams({grant_type: 'refresh_token',
            client_id: this.env.ZOHO_CLIENT_ID!, client_secret: this.env.ZOHO_CLIENT_SECRET!,
            refresh_token: this.env.ZOHO_REFRESH_TOKEN!}),
        });
        const j = await r.json();
        if (!r.ok || j.error || typeof j.access_token !== 'string') throw new Error();
        const ttl = Number(j.expires_in ?? 3600);
        if (!Number.isFinite(ttl) || ttl <= 120) throw new Error();
        this.token = {value: j.access_token, expiresAt: this.clock().getTime() + (ttl - 120) * 1000};
        return j.access_token;
      } catch { throw new ZohoError('TOKEN_REFRESH_FAILED'); }
    })();
    try { return await this.pending; } finally { this.pending = undefined; }
  }
  private async api(path: string, body?: Json): Promise<any> {
    // Authentication happens before the send begins, so refresh failures are not ambiguous sends.
    const token = await this.accessToken();
    try {
      const r = await this.fetcher(`https://mail.zoho.eu/api/accounts${path}`, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(25000),
        headers: {Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json'},
        ...(body ? {body: JSON.stringify(body)} : {}),
      });
      const j = await r.json();
      if (!r.ok || j.status?.code !== 200) {
        if (r.status === 401) this.token = undefined;
        // Even an error response may be produced after the mail server accepted the request.
        throw new ZohoError(body ? 'SEND_OUTCOME_UNKNOWN' : 'MAIL_READ_FAILED', !!body);
      }
      return j.data;
    } catch (error) {
      if (error instanceof ZohoError) throw error;
      throw new ZohoError(body ? 'SEND_OUTCOME_UNKNOWN' : 'MAIL_READ_FAILED', !!body);
    }
  }
  async verifyAccount(): Promise<{accountId: string; from: string}> {
    const accounts = await this.api('');
    if (!Array.isArray(accounts)) throw new ZohoError('INVALID_ACCOUNT_RESPONSE');
    const account = accounts.find(a => String(a.accountId) === this.env.ZOHO_ACCOUNT_ID);
    if (account?.mailboxAddress?.toLowerCase() !== COMPANY_EMAIL || account.outgoingBlocked === true)
      throw new ZohoError('COMPANY_MAILBOX_UNAVAILABLE');
    return {accountId: this.env.ZOHO_ACCOUNT_ID!, from: COMPANY_EMAIL};
  }
  async search(searchKey: string): Promise<MailMessage[]> {
    if (!searchKey || searchKey.length > 1000) throw new ZohoError('INVALID_SEARCH');
    const found = new Map<string, MailMessage>();
    const cutoff = String(this.clock().getTime() + 1000);
    // A fixed cutoff and bounded pagination avoid losing rows while new messages arrive.
    for (let start = 1; start <= 1801; start += 200) {
      const data = await this.api(`/${this.env.ZOHO_ACCOUNT_ID}/messages/search?` + new URLSearchParams({
        searchKey, start: String(start), limit: '200', receivedTime: cutoff, includeto: 'true',
      }));
      if (!Array.isArray(data)) throw new ZohoError('INVALID_SEARCH_RESPONSE');
      for (const raw of data) { const m = mapMessage(raw); found.set(m.messageId, m); }
      if (data.length < 200) return [...found.values()];
    }
    // Never interpret a truncated result as "no reply" or "not contacted".
    throw new ZohoError('SEARCH_TOO_LARGE');
  }
  async content(message: Pick<MailMessage, 'messageId' | 'folderId'>): Promise<string> {
    const data = await this.api(`/${this.env.ZOHO_ACCOUNT_ID}/folders/${id(message.folderId)}/messages/${id(message.messageId)}/content?includeBlockContent=true`);
    if (typeof data?.content !== 'string') throw new ZohoError('INVALID_CONTENT_RESPONSE');
    return data.content;
  }
  async send(input: {to: string; subject: string; body: string; replyToMessageId?: string}): Promise<{messageId: string}> {
    const to = normalizeEmail(input.to);
    if (!input.subject.trim() || input.subject.length > 200 || /[\r\n]/.test(input.subject)
      || !input.body.trim() || input.body.length > 16000) throw new ZohoError('INVALID_EMAIL_CONTENT');
    // A caller cannot override the sender or pass arbitrary headers/CC/BCC.
    const suffix = input.replyToMessageId ? `/${id(input.replyToMessageId)}` : '';
    const data = await this.api(`/${this.env.ZOHO_ACCOUNT_ID}/messages${suffix}`, {
      fromAddress: COMPANY_EMAIL, toAddress: to, subject: input.subject, content: input.body,
      mailFormat: 'plaintext', encoding: 'UTF-8',
      ...(suffix ? {action: 'reply'} : {}),
    });
    try { return {messageId: id(data?.messageId)}; }
    catch { throw new ZohoError('SEND_OUTCOME_UNKNOWN', true); }
  }
}
