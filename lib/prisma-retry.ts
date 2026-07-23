import { prisma } from '@/lib/prisma';
import { isPrismaConnectionError } from '@/lib/prisma-connection-error';

export { isPrismaConnectionError } from '@/lib/prisma-connection-error';

async function resetPrismaConnection() {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  // Keep reset cheap — long sleeps make every nav feel like ~10s
  await new Promise((r) => setTimeout(r, 50));
  try {
    await prisma.$connect();
  } catch {
    // next query will retry connect
  }
}

/**
 * Fail fast on connection errors.
 * Previous defaults (5 attempts × 800/1600/2400/3200ms + 400ms resets)
 * alone could block ~9.6s before the page even started querying.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  delayMs = 200,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isPrismaConnectionError(error) || i === attempts - 1) throw error;
      await resetPrismaConnection();
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}
