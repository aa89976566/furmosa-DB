import { NextResponse } from 'next/server';
import { authenticateLineIdToken } from '@/lib/line/liff-customer';
import { prisma } from '@/lib/prisma';
import { ensureMerchantSettings } from '@/lib/restock-request/service';
import { verifyMerchantLineBindToken } from '@/lib/pos/line-bind-token';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken, bindToken } = (await req.json()) as {
      idToken?: string;
      bindToken?: string;
    };
    if (!idToken?.trim() || !bindToken?.trim()) {
      return NextResponse.json({ error: '缺少 LINE 登入資訊' }, { status: 400 });
    }

    const merchantId = await verifyMerchantLineBindToken(bindToken);
    const { lineUserId } = await authenticateLineIdToken(idToken);
    await ensureMerchantSettings(merchantId);
    await prisma.merchantSettings.update({
      where: { merchantId },
      data: {
        lineNotificationEnabled: true,
        bookingNotifyLineUserId: lineUserId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'LINE 綁定失敗' },
      { status: 400 },
    );
  }
}
