import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthSecretConfigured } from '@/lib/auth-secret';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 輕量健康檢查（不回傳秘密）。
 * 用於確認 Production 的 AUTH_SECRET／DB／merchant_users 是否就緒。
 */
export async function GET() {
  const checks: Record<string, string> = {
    authSecret: isAuthSecretConfigured() ? 'ok' : 'missing',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    checks.database = 'error';
    console.error('[health] database', err);
  }

  try {
    await prisma.merchantUser.findFirst({ select: { id: true }, take: 1 });
    checks.merchantUsers = 'ok';
  } catch (err) {
    checks.merchantUsers = 'error';
    console.error('[health] merchantUsers', err);
  }

  const ok =
    checks.authSecret === 'ok' &&
    checks.database === 'ok' &&
    checks.merchantUsers === 'ok';

  return NextResponse.json(
    { ok, checks, at: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
