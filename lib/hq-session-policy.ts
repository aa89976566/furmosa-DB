export const DEFAULT_HQ_SESSION_DAYS = 180;
export const MAX_HQ_SESSION_DAYS = 365;

export function resolveHqSessionDays(raw = process.env.HQ_SESSION_DAYS) {
  if (!raw) return DEFAULT_HQ_SESSION_DAYS;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > MAX_HQ_SESSION_DAYS) {
    return DEFAULT_HQ_SESSION_DAYS;
  }
  return days;
}

export const HQ_SESSION_DAYS = resolveHqSessionDays();
export const HQ_SESSION_MAX_AGE_SECONDS = HQ_SESSION_DAYS * 24 * 60 * 60;
