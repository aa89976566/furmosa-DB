import { timingSafeEqual } from 'node:crypto';

/**
 * Cron 路由授權（SECURITY H3）。
 * Preview／Production（含 NODE_ENV=production）一律要求 CRON_SECRET + Bearer。
 * 僅本機 development／test 在未設定 secret 時放行，方便本地手動打 cron。
 */

export function requiresCronSecretEnv(
  env: {
    NODE_ENV?: string;
    VERCEL_ENV?: string;
  } = process.env,
): boolean {
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return true;
  return env.NODE_ENV === 'production';
}

function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * @returns true 表示通過授權
 */
export function authorizeCronRequest(
  req: Request,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const secret = typeof env.CRON_SECRET === 'string' ? env.CRON_SECRET.trim() : '';
  if (!secret) {
    return !requiresCronSecretEnv(env);
  }
  const auth = req.headers.get('authorization') ?? '';
  return safeEqualString(auth, `Bearer ${secret}`);
}
