import { financeGet, financePost } from '@/lib/finance/http';
import { productionFinanceDeps, updateChannelCost } from '@/lib/finance/mutations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const sku = new URL(request.url).searchParams.get('sku');
  return financeGet((report) => ({
    sku,
    rows: sku ? report.rows.filter((row) => row.sku === sku) : report.rows,
    unassignedOrders: report.unassignedOrders,
    recordedShippingCents: report.recordedShippingCents,
  }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return financePost(async () => {
    const deps = await productionFinanceDeps();
    return updateChannelCost(
      {
        productId: String(body?.productId ?? ''),
        channel: body?.channel,
        otherDirectCost: body?.otherDirectCost,
        cleaning: body?.cleaning,
        transport: body?.transport,
        groupLeaderShare: body?.groupLeaderShare,
        centerShare: body?.centerShare,
      },
      deps,
    );
  });
}
