export const REQUIRED_READY_ENV = ['AUTH_SECRET', 'NODE_ENV'] as const;
const DB_URL_ENV = ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL'] as const;

// Keep an unresolved probe in flight after an HTTP timeout: Promise.race does
// not cancel a database query, so starting another would accumulate work.
export function createReadinessProbe(query: () => Promise<unknown>, timeoutMs = 2000) {
  let inFlight: Promise<unknown> | undefined;
  return async () => {
    if (!inFlight) {
      inFlight = Promise.resolve().then(query).finally(() => { inFlight = undefined; });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        inFlight,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Readiness timeout')), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}

export type ReadyResult = {
  status: 'ok' | 'error';
  database: 'ok' | 'error' | 'unknown';
  latencyMs: number | null;
  timestamp: string;
};

export async function checkReadiness(input: {
  env: NodeJS.ProcessEnv;
  query: () => Promise<unknown>;
  now?: () => Date;
  clock?: () => number;
}): Promise<{ httpStatus: 200 | 503; body: ReadyResult }> {
  const now = input.now ?? (() => new Date());
  const clock = input.clock ?? (() => performance.now());
  const timestamp = now().toISOString();
  const missing = REQUIRED_READY_ENV.filter((name) => !input.env[name]?.trim());

  if (missing.length > 0 || !DB_URL_ENV.some((name) => input.env[name]?.trim())) {
    return {
      httpStatus: 503,
      body: { status: 'error', database: 'unknown', latencyMs: null, timestamp },
    };
  }

  const startedAt = clock();
  try {
    await input.query();
    const latencyMs = Math.round((clock() - startedAt) * 100) / 100;
    return {
      httpStatus: 200,
      body: { status: 'ok', database: 'ok', latencyMs, timestamp },
    };
  } catch {
    const latencyMs = Math.round((clock() - startedAt) * 100) / 100;
    return {
      httpStatus: 503,
      body: { status: 'error', database: 'error', latencyMs, timestamp },
    };
  }
}
