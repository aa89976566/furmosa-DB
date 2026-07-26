// Edge-compatible auth helpers (for middleware) - 不可使用 Node API / Prisma
import { jwtVerify } from 'jose';
import { getAuthSecretKey } from '@/lib/auth-secret';

const SECRET = getAuthSecretKey();

export const SESSION_COOKIE_NAME = 'furmosa_session';

export async function verifySessionEdge(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
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
