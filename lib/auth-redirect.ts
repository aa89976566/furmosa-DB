const DEFAULT_HQ_DESTINATION = '/dashboard';

export function resolveHqLoginDestination(next?: string) {
  if (!next || next === '/' || !next.startsWith('/') || next.startsWith('//')) {
    return DEFAULT_HQ_DESTINATION;
  }

  return next;
}
