import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

import { ensureDemoAdmin } from '@/scripts/ensure-demo-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function matchesBootstrapKey(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * 一次性 Preview bootstrap。只在非 production 的 Vercel deployment 中啟用；
 * 呼叫完成後必須刪除此 route 與 PREVIEW_DEMO_BOOTSTRAP_KEY。
 */
export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const formKey = formData?.get('key');
  const submittedKey =
    request.headers.get('x-preview-bootstrap-key') ??
    (typeof formKey === 'string' ? formKey : null);

  if (!matchesBootstrapKey(submittedKey, process.env.PREVIEW_DEMO_BOOTSTRAP_KEY)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const report = await ensureDemoAdmin();
    return NextResponse.json({ status: 'ok', report });
  } catch (error) {
    console.error('Preview demo bootstrap failed', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

export function GET() {
  if (process.env.VERCEL_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(
    '<!doctype html><title>Preview bootstrap</title><form method="post"><label>One-time key <input name="key" type="password" autocomplete="off" required></label><button type="submit">Create preview demo</button></form>',
    { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
