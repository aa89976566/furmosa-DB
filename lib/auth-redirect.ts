const DEFAULT_HQ_DESTINATION = '/dashboard';
const DEFAULT_POS_DESTINATION = '/pos';

export function resolveHqLoginDestination(next?: string) {
  if (!next || next === '/' || !next.startsWith('/') || next.startsWith('//')) {
    return DEFAULT_HQ_DESTINATION;
  }

  return next;
}

/**
 * POS only accepts an internal POS route. Keeping this resolution outside the
 * server action lets the action return a normal state object after login
 * instead of throwing a Next redirect response.
 */
export function resolvePosLoginDestination(next?: string) {
  if (!next || !next.startsWith('/pos') || next.startsWith('/pos/login')) {
    return DEFAULT_POS_DESTINATION;
  }

  return next;
}
