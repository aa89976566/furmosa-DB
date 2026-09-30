import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getPointsBalance } from '@/lib/jar-exchange/points';
import { syncCustomerServices, ensureJarExchangeService } from '@/lib/jar-exchange/services';
import { generateJarCode, isValidJarCodeFormat, JAR_CODE_LENGTH } from '@/lib/jar-exchange/codes';

// Never fall back to runtime or production-looking database settings. This
// suite creates and deletes business records, so it may only run when an
// explicitly named, loopback test database is supplied.
const configuredTestDatabaseUrl = process.env.JAR_EXCHANGE_TEST_DATABASE_URL?.trim();
let testDatabaseUrl: string | undefined;
if (configuredTestDatabaseUrl) {
  try {
    const parsed = new URL(configuredTestDatabaseUrl);
    const databaseName = parsed.pathname.replace(/^\//, '').split('?')[0];
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    const testDatabaseName = /^(ci|furmosa_test|jar_exchange_test)$/.test(databaseName);
    if (loopback && testDatabaseName) testDatabaseUrl = configuredTestDatabaseUrl;
  } catch {
    // Invalid or non-isolated URLs leave the suite skipped.
  }
}

describe('jar exchange', { skip: !testDatabaseUrl }, () => {
  let prisma: PrismaClient;
  let customerId: string;
  let rewardId: string;
  let codeA: string;
  let codeB: string;
  let codeC: string;
  let codeD: string;

  before(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl! } },
    });
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
    codeC = generateJarCode();
    codeD = generateJarCode();
    assert.ok(isValidJarCodeFormat(codeA));
    assert.equal(codeA.length, JAR_CODE_LENGTH);
    await prisma.jarCode.createMany({
      data: [
        { code: codeA, pointValue: 1, status: 'unused' },
        { code: codeB, pointValue: 1, status: 'unused' },
        { code: codeC, pointValue: 1, status: 'unused' },
        { code: codeD, pointValue: 1, status: 'unused' },
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
    await prisma.jarCode.deleteMany({ where: { code: { in: [codeA, codeB, codeC, codeD] } } });
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

  it('serializes concurrent redemptions for the same member', async () => {
    const [first, second] = await Promise.all([
      redeemJarCode(customerId, codeC),
      redeemJarCode(customerId, codeD),
    ]);

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(await getPointsBalance(prisma, customerId), 2);
  });
});
