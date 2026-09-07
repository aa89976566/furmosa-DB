import { checkReadiness, createReadinessProbe } from '@/lib/health';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
const probe = createReadinessProbe(() => prisma.$queryRaw`SELECT 1`);

export async function GET() {
  const result = await checkReadiness({
    env: process.env,
    query: probe,
  });

  return Response.json(result.body, {
    status: result.httpStatus,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}
