'use server';

import { redirect } from 'next/navigation';
import { clearMerchantSessionCookie } from '@/lib/merchant-auth';

export async function posLogoutAction() {
  await clearMerchantSessionCookie();
  redirect('/pos/login');
}
