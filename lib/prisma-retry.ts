/** Prisma 暫時無法連線（P1001 / P1017）時重試 */
export function isPrismaConnectionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === 'P1001' || code === 'P1017';
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 600,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isPrismaConnectionError(error) || i === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}
