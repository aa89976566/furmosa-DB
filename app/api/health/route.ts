import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAuthSecretConfigured } from '@/lib/auth-secret';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function summarizeError(err: unknown): { code: string; kind: string } {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code ?? '')
      : '';
  const name = err instanceof Error ? err.name : typeof err;
  const msg = err instanceof Error ? err.message : String(err);
  let kind = 'unknown';
  // auth 必須先於 pool：錯誤訊息常含 pooler 主機名，否則會誤判成 pool_timeout
  if (/P1010|denied|authentication failed|password authentication|Tenant or user not found/i.test(`${code} ${msg}`)) {
    kind = 'auth_failed';
  } else if (/P1001|Can't reach database|ECONNREFUSED|P1000|P1002|ENOTFOUND|ETIMEDOUT/i.test(`${code} ${msg}`)) {
    kind = 'unreachable';
  } else if (/P1017|closed the connection|Connection terminated/i.test(`${code} ${msg}`)) {
    kind = 'connection_closed';
  } else if (/Timed out fetching a new connection from the connection pool|connection pool/i.test(msg)) {
    kind = 'pool_timeout';
  } else if (/P2021|P2022|does not exist/i.test(`${code} ${msg}`)) {
    kind = 'missing_schema';
  } else if (/PrismaClientInitializationError/i.test(name)) {
    kind = 'init_error';
  }
  const safeMsg = msg
    .replace(/\/\/[^@\s]+@/g, '//***:***@')
    .replace(/postgresql:\/\/\S+/gi, 'postgresql://***')
    .slice(0, 160);
  return { code: code || name || 'none', kind: `${kind}:${safeMsg}` };
}

/** 只回傳連線字串形態，不回傳帳密／完整 URL */
function urlShape(url: string | undefined): string {
  if (!url) return 'missing';
  try {
    const u = new URL(url);
    const port = u.port || (u.protocol === 'postgresql:' ? '5432' : '');
    const host = u.hostname;
    const pooled = /pgbouncer=true/i.test(url) || port === '6543';
    const user = u.username;
    // pooler 必須是 postgres.<projectRef>；純 postgres 通常會 auth 失敗
    let userShape = 'missing_user';
    if (/^postgres\.[a-z0-9]+$/i.test(user)) userShape = 'postgres.projectref';
    else if (user === 'postgres') userShape = 'postgres';
    else if (user) userShape = 'other';
    return `${pooled ? 'pooler' : 'session'}://${userShape}@${host}:${port || '?'}`;
  } catch {
    return 'invalid';
  }
}

function hintForAuthFailure(details: Record<string, unknown>): string {
  return (
    'Vercel Production 的 DATABASE_URL／DIRECT_URL 密碼或帳號與 Supabase 不符。' +
    '請到 Vercel → furmosa-db → Settings → Environment Variables，' +
    '用 Supabase Connection pooling（Transaction :6543）更新 DATABASE_URL，' +
    'Session mode :5432 更新 DIRECT_URL；帳號須為 postgres.<projectRef>。' +
    `目前形態：DATABASE_URL=${details.databaseUrl} DIRECT_URL=${details.directUrl}`
  );
}

async function probeUrl(label: string, url: string | undefined) {
  if (!url) {
    return { label, shape: 'missing', ok: false as const, error: { code: 'none', kind: 'missing:url' } };
  }
  const client = new PrismaClient({
    datasources: { db: { url } },
    log: ['error'],
  });
  try {
    await client.$queryRaw`SELECT 1`;
    return { label, shape: urlShape(url), ok: true as const };
  } catch (err) {
    return { label, shape: urlShape(url), ok: false as const, error: summarizeError(err) };
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

/**
 * 輕量健康檢查（不回傳秘密）。
 * 用於確認 Production 的 AUTH_SECRET／DB／merchant_users 是否就緒。
 */
export async function GET() {
  const checks: Record<string, string> = {
    authSecret: isAuthSecretConfigured() ? 'ok' : 'missing',
  };
  const details: Record<string, unknown> = {
    databaseUrl: urlShape(process.env.DATABASE_URL),
    directUrl: urlShape(process.env.DIRECT_URL),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    checks.database = 'error';
    details.database = summarizeError(err);
    console.error('[health] database', err);
  }

  // 分別探測 pooler／direct，判斷是整庫掛了還是只有 runtime URL 壞
  const [pooled, direct] = await Promise.all([
    probeUrl('DATABASE_URL', process.env.DATABASE_URL),
    probeUrl('DIRECT_URL', process.env.DIRECT_URL),
  ]);
  details.probes = { pooled, direct };

  try {
    await prisma.merchantUser.findFirst({ select: { id: true }, take: 1 });
    checks.merchantUsers = 'ok';
  } catch (err) {
    checks.merchantUsers = 'error';
    details.merchantUsers = summarizeError(err);
    console.error('[health] merchantUsers', err);
  }

  const ok =
    checks.authSecret === 'ok' &&
    checks.database === 'ok' &&
    checks.merchantUsers === 'ok';

  const authFailed =
    (typeof details.database === 'object' &&
      details.database &&
      'kind' in details.database &&
      String((details.database as { kind: string }).kind).startsWith('auth_failed')) ||
    pooled.error?.kind.startsWith('auth_failed') ||
    direct.error?.kind.startsWith('auth_failed');

  return NextResponse.json(
    {
      ok,
      checks,
      details,
      ...(authFailed
        ? { fixHint: hintForAuthFailure(details) }
        : {}),
      at: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
