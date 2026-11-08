import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type WishInput = { species: string; requestText: string; lineId: string };
export type WishRecord = { version: 1; species: string; requestText: string; lineId: string; fingerprint: string };
export type WishTask = { id: string; taskId: string; description: string | null; status: string };
type WishTaskCreate = { taskId: string; title: string; description: string; type: string; status: string; priority: string; reference: string };
export type WishTransaction = {
  lock: () => Promise<void>;
  find: (taskId: string) => Promise<WishTask | null>;
  count: (since: Date, reference?: string) => Promise<number>;
  create: (data: WishTaskCreate) => Promise<WishTask>;
};
export type WishStore = { transaction: <T>(run: (tx: WishTransaction) => Promise<T>) => Promise<T> };

export class WishError extends Error {}
const hmac = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('hex');
function checkSecret(secret: string) { if (secret.length < 32) throw new WishError('NOT_CONFIGURED'); }
export function parseWish(input: unknown): WishInput {
  if (!input || typeof input !== 'object') throw new WishError('INVALID_INPUT');
  const v = input as Record<string, unknown>;
  const text = (key: string, min: number, max: number) => {
    const value = typeof v[key] === 'string' ? v[key].trim().replace(/\r\n/g, '\n') : '';
    const controls = key === 'requestText' ? /[\u0000-\u0009\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
    if (value.length < min || value.length > max || controls.test(value)) throw new WishError('INVALID_INPUT');
    return value;
  };
  const species = text('species', 1, 40);
  const requestText = text('requestText', 2, 500);
  const lineId = text('lineId', 4, 20);
  if (!/^[a-z0-9._-]+$/i.test(lineId)) throw new WishError('INVALID_LINE_ID');
  return { species, requestText, lineId };
}

export function issueWishToken(secret: string, now: number, nonce = randomUUID()): string {
  checkSecret(secret);
  const message = `${now}.${nonce}`;
  return `${message}.${hmac(message, secret)}`;
}
export function verifyWishToken(token: string, secret: string, now: number): string {
  checkSecret(secret);
  if (token.length > 200) throw new WishError('INVALID_TOKEN');
  const [time, nonce, signature, extra] = token.split('.');
  if (extra !== undefined || !/^\d{13}$/.test(time ?? '') ||
      !/^[a-z0-9-]{16,64}$/i.test(nonce ?? '') || !/^[a-f0-9]{64}$/.test(signature ?? '')) throw new WishError('INVALID_TOKEN');
  const age = now - Number(time);
  if (age < 1000 || age > 30 * 60 * 1000) throw new WishError('EXPIRED_TOKEN');
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(hmac(`${time}.${nonce}`, secret), 'hex'))) throw new WishError('INVALID_TOKEN');
  return nonce;
}

export function readWish(description: string | null): WishRecord | null {
  try {
    const data = JSON.parse(description ?? '');
    if (data.version !== 1 || typeof data.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(data.fingerprint)) return null;
    return { version: 1, ...parseWish(data), fingerprint: data.fingerprint };
  } catch { return null; }
}

export async function submitWish(input: unknown, token: string, clientAddress: string, config: {
  enabled: boolean; secret: string; now: number;
}, store: WishStore) {
  if (!config.enabled) throw new WishError('DISABLED');
  if (!clientAddress || clientAddress.length > 128) throw new WishError('MISSING_CLIENT');
  const wish = parseWish(input);
  const nonce = verifyWishToken(token, config.secret, config.now);
  const taskId = `WISH-${hmac(`nonce:${nonce}`, config.secret).slice(0, 32)}`;
  const reference = `FMWISH:${hmac(`client:${clientAddress}`, config.secret)}`;
  const fingerprint = hmac(JSON.stringify(wish), config.secret);
  return store.transaction(async tx => {
    // Adapter uses one transaction-scoped PostgreSQL lock, so quotas and replay
    // checks apply across server instances. No raw IP address is persisted.
    await tx.lock();
    const existing = await tx.find(taskId);
    if (existing) {
      if (readWish(existing.description)?.fingerprint !== fingerprint) throw new WishError('REPLAY_CONFLICT');
      return { taskId: existing.taskId, duplicate: true };
    }
    const day = new Date(config.now - 24 * 60 * 60 * 1000);
    if (await tx.count(day, reference) >= 5 || await tx.count(day) >= 100) throw new WishError('RATE_LIMITED');
    const task = await tx.create({
      taskId, title: `許願池｜${wish.species}`, description: JSON.stringify({ version: 1, ...wish, fingerprint }),
      type: 'customer_service', status: 'todo', priority: 'medium', reference,
    });
    return { taskId: task.taskId, duplicate: false };
  });
}

export const wishStatusLabels: Record<string, string> = { todo: '待審核', in_progress: '處理中', done: '已完成', blocked: '暫不受理' };
export function canReviewWishes(role: string | undefined) { return role === 'admin' || role === 'staff'; }
export function wishStatus(value: unknown): 'todo' | 'in_progress' | 'done' | 'blocked' {
  if (typeof value !== 'string' || !Object.hasOwn(wishStatusLabels, value)) throw new WishError('INVALID_STATUS');
  return value as 'todo' | 'in_progress' | 'done' | 'blocked';
}
