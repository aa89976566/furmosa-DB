// Edge-compatible auth helpers (for middleware) - 不可使用 Node API / Prisma
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-secret-only-please-change-me-in-production-32chars-min',
);

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
