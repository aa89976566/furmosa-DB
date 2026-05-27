import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getPointsBalance } from '@/lib/jar-exchange/points';
import { syncCustomerServices, ensureJarExchangeService } from '@/lib/jar-exchange/services';
import { generateJarCode, isValidJarCodeFormat, JAR_CODE_LENGTH } from '@/lib/jar-exchange/codes';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

describe('jar exchange', () => {
  let customerId: string;
  let rewardId: string;
  let codeA: string;
  let codeB: string;

  before(async () => {
    const c = await prisma.customer.create({
      data: {
        customerId: `TEST-JAR-${Date.now()}`,
        name: '換罐測試會員',
        type: 'individual',
      },
    });
    customerId = c.id;
    await syncCustomerServices(prisma, customerId);
    await ensureJarExchangeService(prisma, customerId);

    const sub = await prisma.customerService.findMany({ where: { customerId } });
    assert.ok(sub.some((s) => s.serviceType === 'personal'));
    assert.ok(sub.some((s) => s.serviceType === 'jar_exchange'));

    codeA = generateJarCode();
    codeB = generateJarCode();
    assert.ok(isValidJarCodeFormat(codeA));
    assert.equal(codeA.length, JAR_CODE_LENGTH);
    await prisma.jarCode.createMany({
      data: [
        { code: codeA, pointValue: 1, status: 'unused' },
        { code: codeB, pointValue: 1, status: 'unused' },
      ],
    });

    const reward = await prisma.rewardCatalog.create({
      data: {
        rewardCode: `JAR-RWD-T-${Date.now()}`,
        rewardName: '測試美容券',
        pointsRequired: 2,
        couponFaceValue: 100,
        internalCost: 80,
        activeStatus: 'active',
      },
    });
    rewardId = reward.id;
  });

  after(async () => {
    await prisma.marketingCostRecord.deleteMany({ where: { customerId } });
    await prisma.rewardRedemption.deleteMany({ where: { customerId } });
    await prisma.memberPointsLedger.deleteMany({ where: { customerId } });
    await prisma.jarCode.deleteMany({ where: { code: { in: [codeA, codeB] } } });
    await prisma.customerService.deleteMany({ where: { customerId } });
    await prisma.rewardCatalog.delete({ where: { id: rewardId } }).catch(() => {});
    await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('rejects duplicate jar code redeem', async () => {
    const first = await redeemJarCode(customerId, codeA);
    assert.equal(first.ok, true);
    const dup = await redeemJarCode(customerId, codeA);
    assert.equal(dup.ok, false);
  });

  it('redeems reward only with enough points and books cost', async () => {
    const balanceAfterOne = await getPointsBalance(prisma, customerId);
    assert.equal(balanceAfterOne, 1);

    const fail = await redeemRewardForCustomer(customerId, rewardId);
    assert.equal(fail.ok, false);

    const second = await redeemJarCode(customerId, codeB);
    assert.equal(second.ok, true);
    assert.equal(await getPointsBalance(prisma, customerId), 2);

    const ok = await redeemRewardForCustomer(customerId, rewardId);
    assert.equal(ok.ok, true);
    assert.equal(await getPointsBalance(prisma, customerId), 0);

    const cost = await prisma.marketingCostRecord.findFirst({
      where: { customerId, costCategory: 'jar_return_program' },
    });
    assert.ok(cost);
    assert.equal(cost!.amount, 80);
  });
});
