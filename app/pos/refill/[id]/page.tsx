import { redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';

export const dynamic = 'force-dynamic';

export default async function PosRefillDetailRedirect(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  await requireMerchantSession();
  redirect(`/pos/refill?order=${encodeURIComponent(params.id)}`);
}
