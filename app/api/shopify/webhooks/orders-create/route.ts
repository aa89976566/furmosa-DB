import { orderWebhook } from '@/lib/shopify/webhook-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = orderWebhook('orders/create');
