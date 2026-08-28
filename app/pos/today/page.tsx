import { redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';

export const metadata = { title: '店家 · Furmosa' };
export const dynamic = 'force-dynamic';

export default async function PosTodayRedirectPage() {
  await requireMerchantSession();
  redirect('/pos');
}
