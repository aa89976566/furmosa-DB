import { checkReadiness } from '@/lib/health';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await checkReadiness({
    env: process.env,
    query: () => prisma.$queryRaw`SELECT 1`,
  });

  return Response.json(result.body, {
    status: result.httpStatus,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
