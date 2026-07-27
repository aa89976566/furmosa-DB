import { NextResponse } from 'next/server';
import {
  handleEcpayCallback,
  parseEcpayFormBody,
} from '@/lib/refill/callback';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 綠界 OrderResultURL／ReturnURL（server）。
 * 必須回傳純文字 `1|OK`。
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const params = parseEcpayFormBody(raw);
    const result = await handleEcpayCallback(params);
    return new NextResponse(result.ack, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (e) {
    console.error('[ecpay.callback]', e);
    return new NextResponse('0|Error', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
