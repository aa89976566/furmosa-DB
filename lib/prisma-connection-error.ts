/** Prisma / Supabase pooler 暫時無法連線時判斷（純函式，可於 Client Component 使用） */
export function isPrismaConnectionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code;
    if (code === 'P1001' || code === 'P1017' || code === 'P2024') return true;
  }
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('Connection closed') ||
    msg.includes('Error in PostgreSQL connection') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Connection pool timeout') ||
    msg.includes('Timed out fetching a new connection')
  );
}
