export const REQUIRED_READY_ENV = ['DATABASE_URL', 'AUTH_SECRET', 'NODE_ENV'] as const;

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
  const missing = REQUIRED_READY_ENV.filter((name) => !input.env[name]);

  if (missing.length > 0) {
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
