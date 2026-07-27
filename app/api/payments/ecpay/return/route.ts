import { NextResponse } from 'next/server';
import {
  handleEcpayCallback,
  parseEcpayFormBody,
} from '@/lib/refill/callback';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 顧客瀏覽器導回。可帶 CustomField1（refillOrderId）導向 LIFF 成功頁。
 * 仍會嘗試處理 callback（冪等），但付款真相以 server callback 為準。
 */
async function handleReturn(req: Request) {
  let orderId: string | null = null;
  try {
    if (req.method === 'POST') {
      const raw = await req.text();
      const params = parseEcpayFormBody(raw);
      orderId = params.CustomField1 || null;
      await handleEcpayCallback(params);
    } else {
      const url = new URL(req.url);
      orderId = url.searchParams.get('orderId') || url.searchParams.get('CustomField1');
    }
  } catch (e) {
    console.error('[ecpay.return]', e);
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const target = orderId
    ? `${appUrl}/liff/refill?orderId=${encodeURIComponent(orderId)}&paid=1`
    : `${appUrl}/liff/refill?paid=1`;

  return NextResponse.redirect(target || '/liff/refill?paid=1', 303);
}

export async function GET(req: Request) {
  return handleReturn(req);
}

export async function POST(req: Request) {
  return handleReturn(req);
}
