import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canonicalStoreNumber,
  classifyStoreMerchantPair,
  derivedRedeemSlug,
  isAutomaticSameStore,
  looksLikeDifferentBranches,
  namesLookSimilar,
  normalizeStoreName,
  PARTNER_STORE_IDENTITY_RULES,
} from '@/lib/jar-exchange/partner-store-identity';
import {
  formatAuditReportMarkdown,
  summarizePartnerStoreIdentityAudit,
  type PartnerStoreIdentityAuditSnapshot,
} from '@/lib/jar-exchange/partner-store-identity-audit';

function store(slug: string, name: string, id = `store_${slug}`) {
  return { id, slug, name };
}

function merchant(
  merchantId: string,
  name: string,
  extra: Partial<{ city: string | null; address: string | null; status: string; id: string }> = {},
) {
  return {
    id: extra.id ?? `m_${merchantId}`,
    merchantId,
    name,
    city: extra.city ?? null,
    address: extra.address ?? null,
    status: extra.status ?? 'active',
    types: ['jar_exchange'],
  };
}

describe('partner store identity rules', () => {
  it('uses merchantId as the unique store number and derives the redeem slug', () => {
    assert.equal(canonicalStoreNumber('mer-0018'), 'MER-0018');
    assert.equal(derivedRedeemSlug('MER-0018'), 'mer_0018');
    assert.equal(isAutomaticSameStore('mer_0018', 'MER-0018'), true);
    assert.equal(isAutomaticSameStore('niuniu', 'MER-0018'), false);
    assert.equal(PARTNER_STORE_IDENTITY_RULES.neverAutoMergeByName, true);
    assert.equal(PARTNER_STORE_IDENTITY_RULES.humanReviewOwner, 'hq');
  });

  it('does not treat the same shop name as an automatic match', () => {
    const link = classifyStoreMerchantPair(
      store('niuniu', '淡水妞妞'),
      merchant('MER-0001', '淡水妞妞'),
    );
    assert.ok(link);
    assert.equal(link?.confidence, 'needs_review');
    assert.equal(link?.reason, 'same_name');
  });

  it('auto-matches only when the slug comes from the merchant number', () => {
    const link = classifyStoreMerchantPair(
      store('mer_0018', '墨菲寵物美學（核銷）'),
      merchant('MER-0018', '墨菲寵物美學'),
    );
    assert.equal(link?.confidence, 'auto');
    assert.equal(link?.reason, 'slug_matches_merchant_id');
  });

  it('treats 豬窩分店 as different shops, not one duplicate store', () => {
    assert.equal(looksLikeDifferentBranches('豬窩 中和店', '豬窩 板橋店'), true);
    assert.equal(namesLookSimilar('豬窩中和店', '豬窩 中和店'), true);
    const link = classifyStoreMerchantPair(
      store('zhuwo_zhonghe', '豬窩 中和店'),
      merchant('MER-0020', '豬窩板橋店', { city: '新北', address: '板橋區' }),
    );
    assert.equal(link?.confidence, 'unmatched');
    assert.equal(link?.reason, 'different_branch');
  });

  it('strips company suffixes before comparing names', () => {
    assert.equal(normalizeStoreName('淡水妞妞有限公司'), normalizeStoreName('淡水妞妞'));
    assert.equal(namesLookSimilar('柒沐寵物美容', '柒沐寵物美容工作室'), true);
  });
});

describe('partner store identity audit', () => {
  const snapshot = (): PartnerStoreIdentityAuditSnapshot => ({
    stores: [
      store('mer_0018', '墨菲寵物美學'),
      store('niuniu', '淡水妞妞'),
      store('zhuwo_zhonghe', '豬窩 中和店'),
      store('orphan', '已停用核銷店'),
    ],
    merchants: [
      merchant('MER-0018', '墨菲寵物美學', { city: '新北', address: '板橋區文化路1號' }),
      merchant('MER-0001', '淡水妞妞', { city: '新北', address: '淡水區中正路1號' }),
      merchant('MER-0099', '只在寄賣的店', { city: '台北', address: '大安區1號' }),
      merchant('MER-0020', '豬窩板橋店', { city: '新北', address: '板橋區' }),
      merchant('MER-0021', '豬窩土城店', { city: '新北', address: '土城區' }),
      merchant('MER-0301', '同名店', { city: '台北', address: '信義區1號' }),
      merchant('MER-0302', '同名店', { city: '台中', address: '西區2號' }),
    ],
    merchantUsers: [
      { id: 'u_ok', merchantRecordId: 'm_MER-0018', isActive: true },
      { id: 'u_gap', merchantRecordId: 'm_MER-0001', isActive: true },
      { id: 'u_missing', merchantRecordId: 'missing', isActive: true },
    ],
    refillOrders: [
      { id: 'ro_ok', merchantRecordId: 'm_MER-0018' },
      { id: 'ro_gap', merchantRecordId: 'm_MER-0099' },
    ],
    coupons: [
      { id: 'c_ok', storeKey: 'mer_0018' },
      { id: 'c_missing', storeKey: 'ghost_store' },
    ],
    customers: [
      {
        customerId: 'furmosa-0001',
        signupStore: 'mer_0018',
        storeId: 'mer_0018',
        phoneKey: 'phone-a',
        lineKey: 'line-a',
        hasJarActivity: true,
      },
      {
        customerId: 'furmosa-0002',
        signupStore: 'ghost',
        storeId: 'ghost',
        phoneKey: 'phone-a',
        lineKey: 'line-b',
        hasJarActivity: true,
      },
      {
        customerId: 'furmosa-0003',
        signupStore: null,
        storeId: null,
        phoneKey: null,
        lineKey: 'line-b',
        hasJarActivity: true,
      },
    ],
  });

  it('splits the seven metrics into auto / review / unmatched', () => {
    const report = summarizePartnerStoreIdentityAudit(snapshot(), new Date('2026-08-29T00:00:00.000Z'));

    assert.equal(report.totals.autoLinkedPairs, 1);
    assert.equal(report.metrics.redeemOnlyStores.needs_review, 1);
    assert.equal(report.metrics.redeemOnlyStores.unmatched, 2);
    assert.ok(report.metrics.unmappedStoresAndMerchants.unmatched >= 1);
    assert.equal(report.metrics.sameNameDifferentLocation.auto >= 1, true);
    assert.equal(report.metrics.duplicateOrUnlinkedMembers.needs_review, 1);
    assert.equal(report.metrics.duplicateOrUnlinkedMembers.auto, 1);
    assert.ok(report.metrics.staffOrTxnWithoutStore.unmatched >= 1);
    assert.ok(report.metrics.staffOrTxnWithoutStore.needs_review >= 1);

    const markdown = formatAuditReportMarkdown(report);
    assert.match(markdown, /不顯示|匿名編號|不含姓名/);
    assert.doesNotMatch(markdown, /淡水妞妞|0900|U[0-9a-f]{32}/i);
    assert.match(markdown, /MER-0018|niuniu|furmosa-0002/);
  });

  it('marks one store matching two merchants as needs_review, never auto', () => {
    const report = summarizePartnerStoreIdentityAudit({
      stores: [store('niuniu', '淡水妞妞')],
      merchants: [
        merchant('MER-0001', '淡水妞妞'),
        merchant('MER-0888', '淡水妞妞工作室'),
      ],
      merchantUsers: [],
      refillOrders: [],
      coupons: [],
      customers: [],
    });
    assert.equal(report.metrics.ambiguousMatches.needs_review, 1);
    assert.equal(report.metrics.ambiguousMatches.auto, 0);
    assert.equal(report.metrics.ambiguousMatches.findings[0]?.type, 'store_matches_multiple_merchants');
  });
});
