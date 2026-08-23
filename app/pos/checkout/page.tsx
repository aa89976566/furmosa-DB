import { PosShell } from '@/components/pos/pos-shell';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadCheckoutCatalog } from '@/lib/pos/checkout-service';
import { CheckoutWorkspace } from './checkout-workspace';

export const metadata = { title: '收銀 · Furmosa 店家' };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PosCheckoutPage() {
  const session = await requireMerchantSession();
  const catalog = await loadCheckoutCatalog(session.merchantId);

  return (
    <PosShell>
      <CheckoutWorkspace products={catalog} />
    </PosShell>
  );
}
