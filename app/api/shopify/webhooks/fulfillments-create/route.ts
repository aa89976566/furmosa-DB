import { handleShopifyWebhookRoute } from '@/lib/shopify/webhook-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleShopifyWebhookRoute(request, 'fulfillments/create');
}
