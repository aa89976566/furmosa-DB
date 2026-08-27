import { redirect } from 'next/navigation';
import { requireMerchantSession } from '@/lib/merchant-auth';

export const metadata = { title: '補貨 · Furmosa 店家' };

export default async function PosRestockNewRedirect() {
  await requireMerchantSession();
  redirect('/pos/restock');
}
