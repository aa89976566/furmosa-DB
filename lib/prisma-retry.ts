/** Prisma / Supabase pooler 暫時無法連線時重試 */
export function isPrismaConnectionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code;
    if (code === 'P1001' || code === 'P1017' || code === 'P2024') return true;
  }
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('Connection closed') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Connection pool timeout') ||
    msg.includes('Timed out fetching a new connection')
  );
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
