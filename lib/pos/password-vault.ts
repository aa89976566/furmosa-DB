import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Server-side only. Use a dedicated random 32-byte base64 key, never the session secret. */
function vaultKey() {
  const key = Buffer.from(process.env['POS_PASSWORD_ENCRYPTION_KEY'] ?? '', 'base64');
  if (key.length !== 32) throw new Error('POS 密碼保管功能尚未設定');
  return key;
}

function aad(userId: string, passwordHash: string) {
  return Buffer.from(JSON.stringify(['furmosa-pos-password-v1', userId, passwordHash]));
}

export function encryptPosPassword(password: string, userId: string, passwordHash: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', vaultKey(), iv);
  cipher.setAAD(aad(userId, passwordHash));
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptPosPassword(value: string, userId: string, passwordHash: string): string {
  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('無法讀取已保存密碼');
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('無法讀取已保存密碼');
  const cipher = createDecipheriv('aes-256-gcm', vaultKey(), iv);
  cipher.setAAD(aad(userId, passwordHash));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(Buffer.from(parts[3], 'base64')), cipher.final()]).toString('utf8');
}
