import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export function createLogoutRedirectResponse() {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: '/login' },
  });
}

export async function POST() {
  await clearSessionCookie();
  return createLogoutRedirectResponse();
}
