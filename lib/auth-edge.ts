// Edge-compatible auth helpers (for middleware) - 不可使用 Node API / Prisma
import { jwtVerify } from 'jose';
import { getAuthSecretKey } from '@/lib/auth-secret';

export const SESSION_COOKIE_NAME = 'furmosa_session';

function secretKey(): Uint8Array | null {
  try {
    return getAuthSecretKey();
  } catch (err) {
    console.error('[auth-edge] AUTH_SECRET unavailable', err);
    return null;
  }
}

export async function verifySessionEdge(token?: string) {
  if (!token) return null;
  const key = secretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}
