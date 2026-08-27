import { NextResponse } from 'next/server';
import { loginMerchantWithPassword } from '@/lib/merchant-auth';
import { loginFailureMessage } from '@/lib/auth-errors';

function safeNext(raw: string | null) {
  if (
    raw &&
    raw.startsWith('/pos') &&
    !raw.startsWith('/pos/login')
  ) {
    return raw;
  }
  return '/pos';
}

export async function POST(req: Request) {
  const form = await req.formData();
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNext(String(form.get('next') ?? ''));
  const loginUrl = new URL('/pos/login', req.url);

  if (!username || !password) {
    loginUrl.searchParams.set('error', '請輸入帳號和密碼');
    if (username) loginUrl.searchParams.set('username', username);
    return NextResponse.redirect(loginUrl, 303);
  }

  try {
    const result = await loginMerchantWithPassword(username, password);
    if (!result.ok) {
      loginUrl.searchParams.set('error', result.error);
      loginUrl.searchParams.set('username', username);
      return NextResponse.redirect(loginUrl, 303);
    }
    return NextResponse.redirect(new URL(next, req.url), 303);
  } catch (err) {
    loginUrl.searchParams.set('error', loginFailureMessage(err));
    if (username) loginUrl.searchParams.set('username', username);
    return NextResponse.redirect(loginUrl, 303);
  }
}
