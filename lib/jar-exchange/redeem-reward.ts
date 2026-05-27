import { prisma } from '@/lib/prisma';
import { generateCouponCode } from '@/lib/jar-exchange/codes';
import { appendPointsLedger, getPointsBalance } from '@/lib/jar-exchange/points';
import { ensureJarExchangeService } from '@/lib/jar-exchange/services';

import type { Prisma } from '@prisma/client';

const pad = (n: number, w = 3) => String(n).padStart(w, '0');

async function nextRedemptionCode(tx: Prisma.TransactionClient) {
  const last = await tx.rewardRedemption.findFirst({
    orderBy: { redemptionCode: 'desc' },
    select: { redemptionCode: true },
  });
  const n = last ? parseInt(last.redemptionCode.replace('JAR-RED-', ''), 10) : 0;
  return `JAR-RED-${pad(n + 1)}`;
}

async function nextCostCode(tx: Prisma.TransactionClient) {
  const last = await tx.marketingCostRecord.findFirst({
    orderBy: { costCode: 'desc' },
    select: { costCode: true },
  });
  const n = last ? parseInt(last.costCode.replace('MKT-COST-', ''), 10) : 0;
  return `MKT-COST-${pad(n + 1)}`;
}

export type RedeemRewardResult =
  | {
      ok: true;
      redemptionCode: string;
      couponCode: string;
      pointsSpent: number;
      balanceAfter: number;
      internalCost: number;
    }
  | { ok: false; error: string; status: number };

export async function redeemRewardForCustomer(
  customerId: string,
  rewardId: string,
  createdByUserId?: string | null,
): Promise<RedeemRewardResult> {
  const reward = await prisma.rewardCatalog.findUnique({ where: { id: rewardId } });
  if (!reward || reward.activeStatus !== 'active') {
    return { ok: false, error: '獎勵不存在或已停用', status: 404 };
  }

  const now = new Date();
  if (reward.startAt && reward.startAt > now) {
    return { ok: false, error: '獎勵尚未開始', status: 400 };
  }
  if (reward.endAt && reward.endAt < now) {
    return { ok: false, error: '獎勵已過期', status: 400 };
  }

  const balance = await getPointsBalance(prisma, customerId);
  if (balance < reward.pointsRequired) {
    return { ok: false, error: '點數不足', status: 409 };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bal = await getPointsBalance(tx, customerId);
      if (bal < reward.pointsRequired) {
        throw new JarExchangeError('點數不足', 409);
      }

      await ensureJarExchangeService(tx, customerId);

      const redemptionCode = await nextRedemptionCode(tx);
      const couponCode = generateCouponCode();

      const redemption = await tx.rewardRedemption.create({
        data: {
          redemptionCode,
          customerId,
          rewardId: reward.id,
          pointsSpent: reward.pointsRequired,
          couponCode,
          couponStatus: 'issued',
          partnerMerchantId: reward.partnerMerchantId,
          costBookedStatus: 'booked',
        },
      });

      const ledger = await appendPointsLedger(tx, {
        customerId,
        sourceType: 'reward_redemption',
        sourceRefId: redemption.id,
        pointsChange: -reward.pointsRequired,
        note: `兌換：${reward.rewardName}`,
        createdByUserId,
      });

      const costCode = await nextCostCode(tx);
      await tx.marketingCostRecord.create({
        data: {
          costCode,
          redemptionId: redemption.id,
          customerId,
          amount: reward.internalCost,
          costCategory: 'jar_return_program',
          paymentStatus: 'accrued',
          note: `美容券成本 · ${reward.rewardName}`,
        },
      });

      return {
        redemptionCode,
        couponCode,
        pointsSpent: reward.pointsRequired,
        balanceAfter: ledger.balanceAfter,
        internalCost: reward.internalCost,
      };
    });

    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof JarExchangeError) {
      return { ok: false, error: e.message, status: e.status };
    }
    throw e;
  }
}

class JarExchangeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'JarExchangeError';
  }
}
