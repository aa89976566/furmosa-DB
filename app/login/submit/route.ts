import { NextResponse } from 'next/server';
import { loginWithPassword } from '@/lib/auth';
import { loginFailureMessage } from '@/lib/auth-errors';

function safeNext(raw: string | null) {
  if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/login')) {
    return raw;
  }
  return '/dashboard';
}

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNext(String(form.get('next') ?? ''));
  const loginUrl = new URL('/login', req.url);

  if (!email || !password) {
    loginUrl.searchParams.set('error', '請輸入 Email 和密碼');
    if (email) loginUrl.searchParams.set('email', email);
    return NextResponse.redirect(loginUrl, 303);
  }

  try {
    const result = await loginWithPassword(email, password);
    if (!result.ok) {
      loginUrl.searchParams.set('error', result.error);
      loginUrl.searchParams.set('email', email);
      return NextResponse.redirect(loginUrl, 303);
    }
    return NextResponse.redirect(new URL(next, req.url), 303);
  } catch (err) {
    loginUrl.searchParams.set('error', loginFailureMessage(err));
    if (email) loginUrl.searchParams.set('email', email);
    return NextResponse.redirect(loginUrl, 303);
  }
}
