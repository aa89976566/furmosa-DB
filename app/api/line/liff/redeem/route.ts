import { NextResponse } from 'next/server';
import { authenticateLineIdToken, getLineMemberDashboard } from '@/lib/line/liff-customer';
import { findCustomerByLineUserId } from '@/lib/line/bind-customer';
import { listActiveRewardsForLine, resolveRewardFromLineInput } from '@/lib/line/reward-menu';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken, rewardIndex } = (await req.json()) as {
      idToken?: string;
      rewardIndex?: number | string;
    };

    if (!idToken?.trim()) {
      return NextResponse.json({ error: '缺少登入資訊' }, { status: 400 });
    }

    const { lineUserId } = await authenticateLineIdToken(idToken);
    const customer = await findCustomerByLineUserId(lineUserId);
    if (!customer) {
      return NextResponse.json({ error: '尚未註冊，請先完成加入會員' }, { status: 403 });
    }

    const target = String(rewardIndex ?? '').trim();
    if (!target) {
      return NextResponse.json({ error: '請選擇要兌換的獎勵' }, { status: 400 });
    }

    const rewards = await listActiveRewardsForLine();
    const reward = await resolveRewardFromLineInput(target, rewards);
    if (!reward) {
      return NextResponse.json({ error: '找不到此獎勵項目' }, { status: 404 });
    }

    const result = await redeemRewardForCustomer(customer.id, reward.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const dashboard = await getLineMemberDashboard(idToken);

    return NextResponse.json({
      ok: true,
      rewardName: reward.rewardName,
      pointsSpent: result.pointsSpent,
      balanceAfter: result.balanceAfter,
      couponCode: result.couponCode,
      message: `兌換成功！優惠券碼：${result.couponCode}\n請妥善保存，至合作店家使用。`,
      dashboard: dashboard.registered ? dashboard : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '兌換失敗';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
