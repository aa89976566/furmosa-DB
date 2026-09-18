import { NextResponse } from 'next/server';

export function createLogoutRedirectResponse() {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: '/login' },
  });
}
