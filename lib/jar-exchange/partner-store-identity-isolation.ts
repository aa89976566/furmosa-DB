/**
 * Preview 寫入閘門。未確認與正式庫隔離時，一律拒絕寫入。
 * 只比較專案代號／主機末段／資料庫名稱，不回傳連線或密碼。
 */

/** 正式 Supabase 專案代號（見 docs/FIX-VERCEL-DB-AUTH.md） */
export const PRODUCTION_SUPABASE_PROJECT_REF = 'ukjjopridghvwzobrsus';

export type DatabaseFingerprint = {
  projectRef: string | null;
  hostTail: string;
  databaseName: string;
  port: number | null;
};

export type IsolationDecision =
  | { isolated: true; fingerprint: DatabaseFingerprint }
  | { isolated: false; reason: string; fingerprint: DatabaseFingerprint | null };

function runtimeDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.DATABASE_URL?.trim() ||
    env.POSTGRES_PRISMA_URL?.trim() ||
    env.POSTGRES_URL?.trim() ||
    ''
  );
}

export function describeDatabaseFingerprint(url: string): DatabaseFingerprint | null {
  const raw = url.trim();
  if (!raw) return null;
  if (raw.startsWith('file:')) {
    const name = raw.split('/').pop() || raw;
    return { projectRef: null, hostTail: name, databaseName: name, port: null };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname || '';
  const labels = host.split('.').filter(Boolean);
  const hostTail = labels.slice(-3).join('.') || host;
  const user = decodeURIComponent(parsed.username || '');
  let projectRef: string | null = null;
  if (user.startsWith('postgres.') && user.includes('.')) {
    projectRef = user.slice('postgres.'.length) || null;
  }
  const db = decodeURIComponent(parsed.pathname || '/').replace(/^\//, '') || 'postgres';
  const port = parsed.port ? Number(parsed.port) : null;
  return {
    projectRef,
    hostTail,
    databaseName: db,
    port: Number.isFinite(port) ? port : null,
  };
}

export function decidePreviewIdentityWrite(env: {
  VERCEL_ENV?: string;
  DATABASE_URL?: string;
  POSTGRES_PRISMA_URL?: string;
  POSTGRES_URL?: string;
} = process.env): IsolationDecision {
  if (env.VERCEL_ENV === 'production') {
    return { isolated: false, reason: 'production_forbidden', fingerprint: null };
  }
  if (env.VERCEL_ENV !== 'preview') {
    return { isolated: false, reason: 'not_vercel_preview', fingerprint: null };
  }
  const url = runtimeDatabaseUrl(env);
  const fingerprint = describeDatabaseFingerprint(url);
  if (!fingerprint) {
    return { isolated: false, reason: 'missing_database_url', fingerprint: null };
  }
  if (fingerprint.projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    return { isolated: false, reason: 'same_as_production_supabase', fingerprint };
  }
  if (!fingerprint.projectRef) {
    return { isolated: false, reason: 'unrecognized_database', fingerprint };
  }
  return { isolated: true, fingerprint };
}

export function canWritePreviewIdentityData(
  env: Parameters<typeof decidePreviewIdentityWrite>[0] = process.env,
): boolean {
  return decidePreviewIdentityWrite(env).isolated;
}
