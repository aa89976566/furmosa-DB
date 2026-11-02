type IdTokenClaims = {
  exp?: number;
};

function decodeClaims(token: string): IdTokenClaims | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as IdTokenClaims;
  } catch {
    return null;
  }
}

/**
 * LIFF may keep reporting `isLoggedIn() === true` after its ID token expired.
 * Refresh slightly before expiry so the server never receives a stale token.
 */
export function isLineIdTokenUsable(
  token: string,
  nowMs = Date.now(),
  clockSkewSeconds = 30,
): boolean {
  const claims = decodeClaims(token);
  if (!claims || typeof claims.exp !== 'number') return false;
  return claims.exp > Math.floor(nowMs / 1000) + clockSkewSeconds;
}
