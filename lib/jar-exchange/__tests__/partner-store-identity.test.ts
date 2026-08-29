import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MerchantType } from '@/lib/merchant-types';
import {
  canReissueStoreNumber,
  classifyPartnerStoreIdentity,
  evaluateCooperationChange,
  hasConsignment,
  issueStoreNumber,
  recordHumanIdentityDecision,
  resolveNumberForSiteEvent,
  storeNumberFromRedeemSlug,
  type IdentityMerchant,
  type IdentityStore,
} from '@/lib/jar-exchange/partner-store-identity';

function store(slug: string, name: string, id = `store_${slug}`): IdentityStore {
  return { id, slug, name };
}

function merchant(
  merchantId: string,
  name: string,
  types: MerchantType[] = ['jar_exchange'],
  extra: Partial<Pick<IdentityMerchant, 'city' | 'address' | 'id'>> = {},
): IdentityMerchant {
  return {
    id: extra.id ?? `m_${merchantId}`,
    merchantId,
    name,
    city: extra.city ?? null,
    address: extra.address ?? null,
    status: 'active',
    types,
  };
}

describe('1. 只做換罐也可取得編號，不會被開通寄賣', () => {
  it('issues MER-xxxx with jar_exchange only', () => {
    const issued = issueStoreNumber({
      requestedTypes: ['jar_exchange'],
      existingNumbers: ['MER-0001', 'MER-0018'],
    });
    assert.equal(issued.merchantId, 'MER-0019');
    assert.deepEqual(issued.types, ['jar_exchange']);
    assert.equal(hasConsignment(issued.types), false);
  });

  it('does not add consignment when HQ only asked for jar exchange', () => {
    const issued = issueStoreNumber({
      requestedTypes: ['jar_exchange'],
      existingNumbers: [],
    });
    assert.equal(issued.types.includes('consignment'), false);
  });
});

describe('2–3. 唯一對應才是一對一；重複與一對多是衝突', () => {
  it('classifies mer_0018 + MER-0018 as one_to_one', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('mer_0018', '墨菲寵物美學（核銷）')],
      merchants: [merchant('MER-0018', '墨菲寵物美學')],
    });
    assert.equal(result.stores[0]?.class, 'one_to_one');
    assert.equal(result.merchants[0]?.class, 'one_to_one');
    assert.equal(storeNumberFromRedeemSlug('mer_0018'), 'MER-0018');
    assert.equal(storeNumberFromRedeemSlug('niuniu'), null);
  });

  it('treats two numbers that share a slug as conflict', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('mer_0018', '墨菲')],
      merchants: [merchant('MER-0018', '墨菲'), merchant('mer-0018', '墨菲二')],
    });
    assert.equal(result.stores[0]?.class, 'conflict');
    assert.ok(result.merchants.every((row) => row.class === 'conflict'));
  });

  it('treats two slugs that reverse to the same number as conflict', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('mer_0018', '甲'), store('MER_0018', '乙')],
      merchants: [merchant('MER-0018', '甲')],
    });
    assert.ok(result.stores.every((row) => row.class === 'conflict'));
    assert.equal(result.merchants[0]?.class, 'conflict');
  });
});

describe('4. 店名地址相似只列待確認，不得自動合併', () => {
  it('keeps same-name store and merchant as needs_review', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('niuniu', '淡水妞妞')],
      merchants: [merchant('MER-0001', '淡水妞妞')],
    });
    assert.equal(result.stores[0]?.class, 'needs_review');
    assert.equal(result.merchants[0]?.class, 'needs_review');
    assert.deepEqual(result.stores[0]?.candidateIds, ['MER-0001']);
  });

  it('does not auto-merge 豬窩 branches', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('zhuwo_zhonghe', '豬窩 中和店')],
      merchants: [merchant('MER-0020', '豬窩板橋店', ['jar_exchange'], { city: '新北', address: '板橋區' })],
    });
    assert.notEqual(result.stores[0]?.class, 'one_to_one');
    assert.ok(['needs_review', 'orphan'].includes(result.stores[0]?.class ?? ''));
  });
});

describe('5. 分店各自編號；搬家或改名不得長出新店', () => {
  it('issues a new number for a new branch', () => {
    const resolved = resolveNumberForSiteEvent({
      event: 'new_branch',
      existingNumbers: ['MER-0020'],
    });
    assert.equal(resolved.action, 'issue_new');
    assert.equal(resolved.merchantId, 'MER-0021');
  });

  it('keeps the same number when relocating or renaming', () => {
    assert.deepEqual(
      resolveNumberForSiteEvent({
        event: 'relocate',
        existingMerchantId: 'MER-0020',
        existingNumbers: ['MER-0020'],
      }),
      { merchantId: 'MER-0020', action: 'keep' },
    );
    assert.deepEqual(
      resolveNumberForSiteEvent({
        event: 'rename',
        existingMerchantId: 'MER-0020',
        existingNumbers: ['MER-0020'],
      }),
      { merchantId: 'MER-0020', action: 'keep' },
    );
  });

  it('refuses relocate without an existing number', () => {
    assert.throws(
      () =>
        resolveNumberForSiteEvent({
          event: 'relocate',
          existingNumbers: ['MER-0020'],
        }),
      /不得另開新店/,
    );
  });

  it('never reissues a retired number', () => {
    const issued = issueStoreNumber({
      requestedTypes: ['jar_exchange'],
      existingNumbers: ['MER-0001'],
      retiredNumbers: ['MER-0002'],
    });
    assert.equal(issued.merchantId, 'MER-0003');
    assert.equal(canReissueStoreNumber('MER-0002', ['MER-0002']), false);
  });
});

describe('6. 待確認不新增功能，但不打斷既有服務', () => {
  it('keeps current types and rejects adding consignment', () => {
    const denied = evaluateCooperationChange({
      identityClass: 'needs_review',
      currentTypes: ['jar_exchange'],
      requestedTypes: ['jar_exchange', 'consignment'],
    });
    assert.equal(denied.allowed, false);
    assert.deepEqual(denied.preservedTypes, ['jar_exchange']);

    const unchanged = evaluateCooperationChange({
      identityClass: 'needs_review',
      currentTypes: ['jar_exchange'],
      requestedTypes: ['jar_exchange'],
    });
    assert.equal(unchanged.allowed, true);
    assert.deepEqual(unchanged.preservedTypes, ['jar_exchange']);
  });

  it('lets a one_to_one store change types later', () => {
    const allowed = evaluateCooperationChange({
      identityClass: 'one_to_one',
      currentTypes: ['jar_exchange'],
      requestedTypes: ['jar_exchange', 'consignment'],
    });
    assert.equal(allowed.allowed, true);
  });
});

describe('7. 人工確認必須留下完整判定紀錄', () => {
  it('records reviewer, time, rationale, kept number and the other record', () => {
    const decision = recordHumanIdentityDecision({
      decidedBy: 'hq-staff-01',
      decidedAt: new Date('2026-08-29T12:00:00.000Z'),
      rationale: '同一門市，核銷 slug 是舊自訂名稱',
      keptMerchantId: 'mer-0001',
      otherRecordId: 'store_niuniu',
      otherRecordDisposition: 'merge_into_kept',
    });
    assert.equal(decision.decidedBy, 'hq-staff-01');
    assert.equal(decision.decidedAt, '2026-08-29T12:00:00.000Z');
    assert.equal(decision.rationale, '同一門市，核銷 slug 是舊自訂名稱');
    assert.equal(decision.keptMerchantId, 'MER-0001');
    assert.equal(decision.otherRecordId, 'store_niuniu');
    assert.equal(decision.otherRecordDisposition, 'merge_into_kept');
  });

  it('rejects an incomplete confirmation', () => {
    assert.throws(
      () =>
        recordHumanIdentityDecision({
          decidedBy: '',
          rationale: 'ok',
          keptMerchantId: 'MER-0001',
          otherRecordId: 'store_niuniu',
          otherRecordDisposition: 'merge_into_kept',
        }),
      /確認人/,
    );
  });
});

describe('8. 這一圈不修資料、不合併', () => {
  it('classification never invents a merged store', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('niuniu', '淡水妞妞'), store('mer_0001', '淡水妞妞')],
      merchants: [merchant('MER-0001', '淡水妞妞')],
    });
    assert.equal(result.stores.length, 2);
    assert.equal(result.merchants.length, 1);
    assert.ok(result.stores.some((row) => row.class === 'one_to_one'));
    assert.ok(result.stores.some((row) => row.class === 'needs_review'));
  });

  it('orphan when a mer_ slug points at a missing number', () => {
    const result = classifyPartnerStoreIdentity({
      stores: [store('mer_0999', '幽靈店')],
      merchants: [merchant('MER-0018', '墨菲')],
    });
    assert.equal(result.stores[0]?.class, 'orphan');
  });
});
