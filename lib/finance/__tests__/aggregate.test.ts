import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { assemblePartnerEconomics, assembleSkuEconomics } from '@/lib/finance/aggregate';
import type { CatalogProduct } from '@/lib/finance/aggregate';
import { loadPosEconomics, posResponseHasCompanyCost, toPosEconomicsResponse } from '@/lib/finance/pos-economics';
import { scopedMerchantId } from '@/lib/finance/access-policy';

const product: CatalogProduct = {
  id: 'p1',
  sku: 'DK-01',
  name: '凍乾',
  price: 200,
  foodCostCents: 4000,
  packagingCostCents: 500,
  status: 'active',
};

describe('通路組裝', () => {
  it('官網有訂單時分潤為 0，團購沒有交易就保持缺資料', () => {
    const rows = assembleSkuEconomics({
      products: [product],
      actuals: [
        {
          productId: 'p1',
          channel: 'website',
          quantity: 2,
          receiptCents: 36000,
          channelShareCents: 0,
          customerPaidCents: null,
        },
      ],
      settings: [
        {
          productId: 'p1',
          channel: 'website',
          otherDirectCostCents: 100,
          cleaningCents: null,
          transportCents: null,
          groupLeaderShareCents: null,
          centerShareCents: null,
        },
      ],
      thresholds: { greenMinBps: 4500, yellowMinBps: 3000 },
    });
    const website = rows.find((row) => row.channel === 'website');
    const groupBuy = rows.find((row) => row.channel === 'group_buy');
    assert.equal(website?.unitBrandReceiptCents, 18000);
    assert.equal(website?.unitChannelShareCents, 0);
    assert.equal(website?.contributionCents, 18000 - 4000 - 500 - 100);
    assert.equal(website?.light, 'green');
    assert.equal(groupBuy?.quantity, 0);
    assert.equal(groupBuy?.unitBrandReceiptCents, null);
    assert.equal(groupBuy?.contributionCents, null);
    assert.equal(groupBuy?.rateBps, null);
    assert.equal(groupBuy?.light, null);
  });

  it('換罐扣項缺一項時，該列貢獻毛利是缺資料', () => {
    const rows = assembleSkuEconomics({
      products: [product],
      actuals: [
        {
          productId: 'p1',
          channel: 'refill',
          quantity: 1,
          receiptCents: null,
          channelShareCents: null,
          customerPaidCents: 9900,
        },
      ],
      settings: [
        {
          productId: 'p1',
          channel: 'refill',
          otherDirectCostCents: 0,
          cleaningCents: 100,
          transportCents: null,
          groupLeaderShareCents: 300,
          centerShareCents: 400,
        },
      ],
      thresholds: { greenMinBps: 4500, yellowMinBps: 3000 },
    });
    const refill = rows.find((row) => row.channel === 'refill');
    assert.equal(refill?.unitBrandReceiptCents, null);
    assert.equal(refill?.contributionCents, null);
    assert.equal(refill?.contributionMissing, 'data');
  });

  it('店家有銷售但缺食品成本時，營收仍可看，貢獻毛利不計算', () => {
    const [store] = assemblePartnerEconomics({
      stores: [{
        id: 'm1',
        code: 'MER-1',
        name: '中心店',
        stockUnits: 4,
        restockCount90: 1,
        everRestocked: true,
        lastRestockAt: new Date('2026-09-01T00:00:00.000Z'),
        refillCount: 2,
      }],
      activity: [{
        merchantId: 'm1',
        productId: 'p1',
        channel: 'pos',
        quantity: 2,
        grossCents: 40000,
        commissionCents: 8000,
        companyRevenueCents: 32000,
        customerPaidCents: null,
      }],
      products: [{ ...product, foodCostCents: null }],
      settings: [{
        productId: 'p1',
        channel: 'pos',
        otherDirectCostCents: 0,
        cleaningCents: null,
        transportCents: null,
        groupLeaderShareCents: null,
        centerShareCents: null,
      }],
    });
    assert.equal(store?.revenueCents, 40000);
    assert.equal(store?.commissionCents, 8000);
    assert.equal(store?.contributionCents, null);
    assert.equal(store?.contributionMissing, 'cost');
  });

  it('沒有銷售的店顯示空狀態，不用 0 元營收', () => {
    const [store] = assemblePartnerEconomics({
      stores: [{
        id: 'm2',
        code: 'MER-2',
        name: '新店',
        stockUnits: 0,
        restockCount90: 0,
        everRestocked: false,
        lastRestockAt: null,
        refillCount: 0,
      }],
      activity: [],
      products: [product],
      settings: [],
    });
    assert.equal(store?.revenueState, 'empty');
    assert.equal(store?.revenueCents, null);
    assert.equal(store?.contributionCents, null);
  });
});

describe('店家 POS 範圍', () => {
  it('回傳不含公司成本，而且忽略別店 id', () => {
    const payload = toPosEconomicsResponse({
      merchantId: scopedMerchantId('store-a', 'store-b'),
      refillCount: 1,
      rows: [{
        productId: 'p1',
        sku: 'DK-01',
        name: '凍乾',
        sellingPriceCents: 20000,
        wholesalePricesCents: [12000],
        commissionPerUnitCents: 3000,
        stockUnits: 5,
        soldQuantity: 1,
        salesGrossCents: 20000,
        earnedCommissionCents: 3000,
      }],
    });
    assert.equal(payload.merchantId, 'store-a');
    assert.equal(posResponseHasCompanyCost(payload), false);
    const page = readFileSync('app/pos/economics/page.tsx', 'utf8');
    const route = readFileSync('app/api/merchant/economics/route.ts', 'utf8');
    const loader = readFileSync('lib/finance/pos-economics.ts', 'utf8');
    assert.match(page, /requireMerchantSession/);
    assert.match(route, /requireMerchantSession/);
    assert.match(route, /loadPosEconomics\(session\.merchantId/);
    assert.match(loader, /select: \{ id: true, sku: true, name: true, price: true \}/);
    assert.doesNotMatch(loader, /foodCostCents:\s*true|packagingCostCents:\s*true|companyRevenue:/);
    assert.equal(typeof loadPosEconomics, 'function');
  });
});
