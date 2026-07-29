import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getAuthSecretKey } from '@/lib/auth-secret';
import { isDbUnreachableError, loginFailureMessage } from '@/lib/auth-errors';

const SESSION_COOKIE = 'furmosa_session';
const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? '168'); // 預設 7 天

function secretKey() {
  return getAuthSecretKey();
}

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function readSession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return readSession(token);
}

function maskDbUrl(url: string): string {
  if (!url) return '(未設定)';
  if (url.startsWith('file:')) return url;
  return url.replace(/\/\/[^@]*@/, '//***:***@');
}

export async function loginWithPassword(email: string, password: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { ok: false as const, error: '帳號不存在' };
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return { ok: false as const, error: '密碼錯誤' };
    const token = await signSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await setSessionCookie(token);
    return { ok: true as const, user };
  } catch (e) {
    if (isDbUnreachableError(e)) {
      const url = process.env.DATABASE_URL ?? '';
      const masked = maskDbUrl(url);
      const isPg = url.includes('5432') || /^postgres(ql)?:\/\//.test(url);
      const advice = isPg
        ? '目前 dev server 啟動時讀到的是 PostgreSQL，但本機沒有在 5432 執行資料庫。請改成 SQLite：把 .env 設成 `DATABASE_URL="file:./dev.db"`，殺掉所有舊的 `next dev` 程序，再重新 `npm run dev`。'
        : 'dev server 連不到資料庫。常見原因：你開了多個 `next dev` 視窗，舊的那個讀到的是舊的 .env。請執行 `lsof -nP -iTCP:3000-3010 -sTCP:LISTEN` 找出全部 node 程序、`kill <pid>` 殺掉，再執行一次 `npm run db:setup` 與 `npm run dev`。';
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        return { ok: false as const, error: loginFailureMessage(e) };
      }
      return {
        ok: false as const,
        error: `${advice}\n（dev server 啟動時抓到的 DATABASE_URL：${masked}）`,
      };
    }
    return { ok: false as const, error: loginFailureMessage(e) };
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
