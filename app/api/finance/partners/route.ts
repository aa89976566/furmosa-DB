import { financeGet } from '@/lib/finance/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return financeGet((report) => ({ partners: report.partners }));
}
