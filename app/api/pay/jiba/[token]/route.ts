import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 開箱運費改為銀行轉帳，不再提供線上自助標記付款。
 * 入帳請由壽司匠在後台「確認已入帳並排入出貨」。
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: '請使用銀行轉帳，並回 LINE 告知壽司匠。',
    },
    { status: 405 },
  );
}
