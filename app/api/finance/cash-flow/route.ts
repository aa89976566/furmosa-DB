import { financeGet, financePost } from '@/lib/finance/http';
import { CASH_WEEK_COUNT } from '@/lib/finance/channels';
import { productionFinanceDeps, updateCashPlan } from '@/lib/finance/mutations';

export const dynamic = 'force-dynamic';

export async function GET() {
  return financeGet((report) => ({ cash: report.cash }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const weeks = Array.isArray(body?.weeks) ? body.weeks : [];
  return financePost(async () => {
    const deps = await productionFinanceDeps();
    return updateCashPlan(
      {
        openingBalance: body?.openingBalance,
        minimumCash: body?.minimumCash,
        weeks: Array.from({ length: CASH_WEEK_COUNT }, (_, index) => weeks[index] ?? {}),
      },
      deps,
    );
  });
}
