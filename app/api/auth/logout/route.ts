import { clearSessionCookie } from '@/lib/auth';
import { createLogoutRedirectResponse } from '@/lib/logout-redirect';

export async function POST() {
  await clearSessionCookie();
  return createLogoutRedirectResponse();
}
