/**
 * Process-local job throttle for serverless warm instances.
 * Not a distributed lock — pair with cron for guaranteed runs.
 */

type ThrottleStore = Map<string, number>;

function store(): ThrottleStore {
  const g = globalThis as typeof globalThis & { __furmosaJobThrottle?: ThrottleStore };
  if (!g.__furmosaJobThrottle) g.__furmosaJobThrottle = new Map();
  return g.__furmosaJobThrottle;
}

/** Default: skip re-running heavy maintenance within 5 minutes on the same instance */
export const DEFAULT_JOB_TTL_MS = 5 * 60 * 1000;

export function shouldRunJob(
  key: string,
  ttlMs = DEFAULT_JOB_TTL_MS,
  now = Date.now(),
): boolean {
  const last = store().get(key);
  if (last != null && now - last < ttlMs) return false;
  return true;
}

export function markJobRan(key: string, now = Date.now()): void {
  store().set(key, now);
}

export function clearJobThrottle(key?: string): void {
  if (key) store().delete(key);
  else store().clear();
}

export function peekJobLastRun(key: string): number | undefined {
  return store().get(key);
}

/**
 * Run `fn` at most once per `ttlMs` per process.
 * Returns `{ ran: false }` when skipped, otherwise `{ ran: true, result }`.
 */
export async function runThrottled<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEFAULT_JOB_TTL_MS,
): Promise<{ ran: false } | { ran: true; result: T }> {
  if (!shouldRunJob(key, ttlMs)) return { ran: false };
  // Mark before await so concurrent callers on same instance skip
  markJobRan(key);
  try {
    const result = await fn();
    return { ran: true, result };
  } catch (error) {
    // Allow retry soon after failure
    store().delete(key);
    throw error;
  }
}
