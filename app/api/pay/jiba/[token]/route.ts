import { NextResponse } from 'next/server';
import { completeJibaPayment } from '@/lib/line/campaigns/jiba-unbox/flow';

export const runtime = 'nodejs';

/** 運費付款完成（冪等）。後續可改接綠界 webhook，仍呼叫同一 completeJibaPayment。 */
export async function POST(
  _req: Request,
  { params }: { params: { token: string } },
) {
  try {
    const result = await completeJibaPayment(params.token);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true, alreadyPaid: result.alreadyPaid ?? false });
  } catch (e) {
    const message = e instanceof Error ? e.message : '付款處理失敗';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
