import { redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';

export const dynamic = 'force-dynamic';

export default async function PosRefillDetailRedirect({
  params,
}: {
  params: { id: string };
}) {
  await requireMerchantSession();
  redirect(`/pos/refill?order=${encodeURIComponent(params.id)}`);
}
