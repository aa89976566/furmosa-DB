import { authorizeCronRequest } from '@/lib/cron-auth';
import { prisma } from '@/lib/prisma';
import { runCatalogAutoCreate } from '@/lib/shopify/catalog-auto-create';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!authorizeCronRequest(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // No scheduled invocation or production enablement is installed by this change.
  if (process.env.SHOPIFY_CATALOG_AUTOMATION_ENABLED !== 'true') return Response.json({ enabled: false });
  const mode = process.env.SHOPIFY_CATALOG_AUTOMATION_MODE === 'create' ? 'create' : 'inspect';
  try { return Response.json(await runCatalogAutoCreate(prisma, mode, 2)); }
  catch { return Response.json({ error: 'CATALOG_AUTOMATION_FAILED' }, { status: 503 }); }
}
