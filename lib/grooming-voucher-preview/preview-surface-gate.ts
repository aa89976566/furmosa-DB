/** Edge-safe Preview login surface gate. Path and env string checks only. */

export const GROOMING_PREVIEW_PATH = '/preview/grooming-voucher';

export type PreviewSurfaceEnv = {
  VERCEL_ENV?: string;
  GROOMING_PREVIEW_AUTH_ENABLED?: string;
  GROOMING_PREVIEW_BRANCH?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  GROOMING_PREVIEW_COOKIE_SECRET?: string;
};

export type PreviewSurfaceDecision = 'bypass_hq' | 'continue';

export function readPreviewSurfaceEnv(
  source: Record<string, string | undefined>,
): PreviewSurfaceEnv {
  return {
    VERCEL_ENV: source.VERCEL_ENV,
    GROOMING_PREVIEW_AUTH_ENABLED: source.GROOMING_PREVIEW_AUTH_ENABLED,
    GROOMING_PREVIEW_BRANCH: source.GROOMING_PREVIEW_BRANCH,
    VERCEL_GIT_COMMIT_REF: source.VERCEL_GIT_COMMIT_REF,
    GROOMING_PREVIEW_COOKIE_SECRET: source.GROOMING_PREVIEW_COOKIE_SECRET,
  };
}

export function isExactGroomingPreviewPath(pathname: string): boolean {
  return pathname === GROOMING_PREVIEW_PATH;
}

export function isGroomingPreviewSurfaceOpen(env: PreviewSurfaceEnv): boolean {
  const branch = env.GROOMING_PREVIEW_BRANCH?.trim() ?? '';
  const ref = env.VERCEL_GIT_COMMIT_REF?.trim() ?? '';
  const secret = env.GROOMING_PREVIEW_COOKIE_SECRET?.trim() ?? '';
  return (
    env.VERCEL_ENV === 'preview' &&
    env.GROOMING_PREVIEW_AUTH_ENABLED === 'true' &&
    branch.length > 0 &&
    ref.length > 0 &&
    ref === branch &&
    secret.length > 0
  );
}

export function decideGroomingPreviewSurfaceAccess(input: {
  pathname: string;
  env: PreviewSurfaceEnv;
}): PreviewSurfaceDecision {
  if (!isExactGroomingPreviewPath(input.pathname)) return 'continue';
  if (!isGroomingPreviewSurfaceOpen(input.env)) return 'continue';
  return 'bypass_hq';
}

export function shouldBypassHqForGroomingPreviewSurface(input: {
  pathname: string;
  env: PreviewSurfaceEnv | NodeJS.ProcessEnv | Record<string, string | undefined>;
}): boolean {
  return (
    decideGroomingPreviewSurfaceAccess({
      pathname: input.pathname,
      env: readPreviewSurfaceEnv(input.env),
    }) === 'bypass_hq'
  );
}
