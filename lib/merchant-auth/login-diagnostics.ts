type LoginStage = 'ACCOUNT_NOT_FOUND' | 'ACCOUNT_INACTIVE' | 'PASSWORD_MISMATCH' | 'AUTHENTICATED';
type DiagnosticEnv = {
  VERCEL_ENV?: string;
  DATABASE_URL?: string;
  POSTGRES_PRISMA_URL?: string;
  POSTGRES_URL?: string;
};

/** Fixed preview-only fields; never return an input, hostname, username or exception. */
export function previewLoginDiagnostic(stage: LoginStage, env: DiagnosticEnv, projectRef: string) {
  if (env.VERCEL_ENV !== 'preview') return null;
  const value = env.DATABASE_URL?.trim() || env.POSTGRES_PRISMA_URL?.trim() || env.POSTGRES_URL?.trim();
  let isolatedDatabaseMatches = false;
  try {
    const url = new URL(value ?? '');
    isolatedDatabaseMatches =
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      decodeURIComponent(url.pathname) === '/postgres' &&
      (url.hostname === `db.${projectRef}.supabase.co` ||
        (url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === `postgres.${projectRef}`));
  } catch { /* URL errors can contain credentials. Never log them. */ }
  return { code: 'POS_PREVIEW_LOGIN_DIAGNOSTIC' as const, stage, isolatedDatabaseMatches };
}
