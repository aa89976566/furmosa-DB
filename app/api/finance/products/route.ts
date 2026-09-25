import { financeGet, financePost } from '@/lib/finance/http';
import { productionFinanceDeps, updateProductCosts } from '@/lib/finance/mutations';

export const dynamic = 'force-dynamic';

export async function GET() {
  return financeGet((report) => ({
    thresholds: report.thresholds,
    rows: report.rows,
  }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return financePost(async () => {
    const deps = await productionFinanceDeps();
    return updateProductCosts(
      {
        productId: String(body?.productId ?? ''),
        foodCost: body?.foodCost,
        packagingCost: body?.packagingCost,
      },
      deps,
    );
  });
}
