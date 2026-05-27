type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkLineRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: true } | { ok: false } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (existing.count >= opts.limit) return { ok: false };
  existing.count += 1;
  return { ok: true };
}
