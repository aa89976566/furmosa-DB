const LINE_WEBHOOK_DEDUPE_TTL_MS = 10 * 60 * 1000;
const seen = new Map<string, number>();

function prune(now: number) {
  if (seen.size < 500) return;
  for (const [key, expiresAt] of seen) {
    if (expiresAt <= now) seen.delete(key);
  }
}

export function claimLineWebhookEvent(eventId: string | null | undefined, now = Date.now()): boolean {
  const key = eventId?.trim();
  if (!key) return true;

  const expiresAt = seen.get(key);
  if (expiresAt && expiresAt > now) return false;

  seen.set(key, now + LINE_WEBHOOK_DEDUPE_TTL_MS);
  prune(now);
  return true;
}

export function releaseLineWebhookEvent(eventId: string | null | undefined): void {
  const key = eventId?.trim();
  if (key) seen.delete(key);
}

export function resetLineWebhookDedupeForTest(): void {
  seen.clear();
}

export { LINE_WEBHOOK_DEDUPE_TTL_MS };
