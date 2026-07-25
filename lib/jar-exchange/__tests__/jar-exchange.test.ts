import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { redeemJarCode } from '@/lib/jar-exchange/redeem-code';
import { redeemRewardForCustomer } from '@/lib/jar-exchange/redeem-reward';
import { getPointsBalance } from '@/lib/jar-exchange/points';
import { syncCustomerServices, ensureJarExchangeService } from '@/lib/jar-exchange/services';
import { generateJarCode, isValidJarCodeFormat, JAR_CODE_LENGTH } from '@/lib/jar-exchange/codes';
import { SIGNUP_REQUIRED_FOR_DEPOSIT_MESSAGE } from '@/lib/jar-exchange/location';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

describe('jar exchange', () => {
  let customerId: string;
  let merchantId: string;
  let productId: string;
  let rewardId: string;
  let codeA: string;
  let codeB: string;
  let codeNoStore: string;

  before(async () => {
    const merchant = await prisma.merchant.create({
      data: {
        merchantId: `MER-T${Date.now().toString().slice(-6)}`,
        name: `換罐測試店 ${Date.now()}`,
        type: 'jar_exchange',
        types: ['jar_exchange'],
        status: 'active',
      },
    });
    merchantId = merchant.id;

    await prisma.merchantRedeemProfile.create({
      data: {
        merchantId,
        slug: `test_jar_${Date.now()}`,
        secretToken: 'abc123',
        active: true,
      },
    });

    const product = await prisma.product.create({
      data: {
        productId: `PROD-T${Date.now().toString().slice(-5)}`,
        sku: `SKU-T${Date.now().toString().slice(-5)}`,
        name: '測試換罐商品',
        productCategory: 'JAR_EXCHANGE',
        price: 100,
        cost: 40,
        status: 'active',
      },
    });
    productId = product.id;

    const c = await prisma.customer.create({
      data: {
        customerId: `TEST-JAR-${Date.now()}`,
        name: '換罐測試會員',
        type: 'individual',
        signupLocationId: merchantId,
        signupStore: 'test',
        storeId: 'test',
        storeName: merchant.name,
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
    codeNoStore = generateJarCode();
    assert.ok(isValidJarCodeFormat(codeA));
    assert.equal(codeA.length, JAR_CODE_LENGTH);
    await prisma.jarCode.createMany({
      data: [
        {
          code: codeA,
          pointValue: 1,
          status: 'unused',
          productId,
          productSku: product.sku,
        },
        {
          code: codeB,
          pointValue: 1,
          status: 'unused',
          productId,
          productSku: product.sku,
        },
        {
          code: codeNoStore,
          pointValue: 1,
          status: 'unused',
          productId,
          productSku: product.sku,
        },
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
    await prisma.merchantStockTxn.deleteMany({ where: { merchantId } });
    await prisma.merchantStock.deleteMany({ where: { merchantId } });
    await prisma.orderItem.deleteMany({
      where: { order: { customerId } },
    });
    await prisma.order.deleteMany({ where: { customerId } });
    await prisma.jarCode.deleteMany({
      where: { code: { in: [codeA, codeB, codeNoStore] } },
    });
    await prisma.customerService.deleteMany({ where: { customerId } });
    await prisma.rewardCatalog.delete({ where: { id: rewardId } }).catch(() => {});
    await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    await prisma.merchantRedeemProfile.deleteMany({ where: { merchantId } });
    await prisma.product.delete({ where: { id: productId } }).catch(() => {});
    await prisma.merchant.delete({ where: { id: merchantId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('blocks deposit without signup location and does not consume code', async () => {
    const orphan = await prisma.customer.create({
      data: {
        customerId: `TEST-JAR-NS-${Date.now()}`,
        name: '無開戶店會員',
        type: 'individual',
      },
    });
    try {
      const res = await redeemJarCode(orphan.id, codeNoStore);
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.error, SIGNUP_REQUIRED_FOR_DEPOSIT_MESSAGE);
      }
      const code = await prisma.jarCode.findUnique({ where: { code: codeNoStore } });
      assert.equal(code?.status, 'unused');
    } finally {
      await prisma.customer.delete({ where: { id: orphan.id } });
    }
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

    const stock = await prisma.merchantStock.findFirst({
      where: { merchantId, productId },
    });
    assert.ok(stock);
    assert.ok((stock?.quantity ?? 0) <= -1);

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
