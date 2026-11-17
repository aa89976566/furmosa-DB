import { authorizeCronRequest } from '@/lib/cron-auth';
import { prisma } from '@/lib/prisma';
import { runSalmonInventorySync } from '@/lib/shopify/salmon-inventory-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!authorizeCronRequest(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.SHOPIFY_INVENTORY_SYNC_ENABLED !== 'true') return Response.json({ enabled: false });
  const mode = process.env.SHOPIFY_INVENTORY_SYNC_MODE === 'apply' ? 'apply' : 'inspect';
  try { return Response.json(await runSalmonInventorySync(prisma, mode)); }
  catch { return Response.json({ error: 'INVENTORY_SYNC_BLOCKED_CHECK_AUDIT' }, { status: 503 }); }
}
