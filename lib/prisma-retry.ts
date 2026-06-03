import { prisma } from '@/lib/prisma';
import { isPrismaConnectionError } from '@/lib/prisma-connection-error';

export { isPrismaConnectionError } from '@/lib/prisma-connection-error';

async function resetPrismaConnection() {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  await new Promise((r) => setTimeout(r, 400));
  try {
    await prisma.$connect();
  } catch {
    // next query will retry connect
  }
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 5,
  delayMs = 800,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isPrismaConnectionError(error) || i === attempts - 1) throw error;
      await resetPrismaConnection();
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}
