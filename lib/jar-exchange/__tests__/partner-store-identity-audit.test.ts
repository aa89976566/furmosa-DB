import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findRecordsInMultipleClasses,
  formatAuditReportMarkdown,
  summarizePartnerStoreIdentityAudit,
  type PartnerStoreIdentityAuditSnapshot,
} from '@/lib/jar-exchange/partner-store-identity-audit';

const meta = {
  environmentName: 'unit-test',
  dataSource: 'unit-test' as const,
  databaseConfigured: false,
  queriedLiveData: false,
};

function snapshot(partial: Partial<PartnerStoreIdentityAuditSnapshot> = {}): PartnerStoreIdentityAuditSnapshot {
  return {
    stores: [
      { id: 's1', slug: 'mer_0018', name: '墨菲寵物美學' },
      { id: 's2', slug: 'niuniu', name: '淡水妞妞' },
      { id: 's3', slug: 'mer_0999', name: '幽靈店' },
    ],
    merchants: [
      {
        id: 'm1',
        merchantId: 'MER-0018',
        name: '墨菲寵物美學',
        city: '新北',
        address: '板橋',
        status: 'active',
        types: ['jar_exchange'],
      },
      {
        id: 'm2',
        merchantId: 'MER-0001',
        name: '淡水妞妞',
        city: '新北',
        address: '淡水',
        status: 'active',
        types: ['jar_exchange'],
      },
    ],
    merchantUsers: [
      { id: 'u1', merchantRecordId: 'm1' },
      { id: 'u2', merchantRecordId: 'missing' },
    ],
    refillOrders: [{ id: 'ro1', merchantRecordId: 'm2' }],
    coupons: [
      { id: 'c1', storeKey: 'mer_0018' },
      { id: 'c2', storeKey: 'ghost' },
    ],
    customers: [
      {
        customerId: 'furmosa-0001',
        signupStore: 'mer_0018',
        storeId: 'mer_0018',
        phoneKey: 'p-a',
        lineKey: 'l-a',
        hasJarActivity: true,
      },
      {
        customerId: 'furmosa-0002',
        signupStore: 'ghost',
        storeId: 'ghost',
        phoneKey: 'p-a',
        lineKey: 'l-b',
        hasJarActivity: true,
      },
      {
        customerId: 'furmosa-0003',
        signupStore: null,
        storeId: null,
        phoneKey: null,
        lineKey: 'l-b',
        hasJarActivity: true,
      },
    ],
    ...partial,
  };
}

function sixPairedStores(): PartnerStoreIdentityAuditSnapshot {
  const stores = Array.from({ length: 6 }, (_, index) => {
    const n = String(index + 1).padStart(4, '0');
    return { id: `s${n}`, slug: `mer_${n}`, name: `門市${n}` };
  });
  const merchants = stores.map((store, index) => ({
    id: `m${index + 1}`,
    merchantId: `MER-${String(index + 1).padStart(4, '0')}`,
    name: store.name,
    city: null,
    address: null,
    status: 'active' as const,
    types: ['jar_exchange' as const],
  }));
  return {
    stores,
    merchants,
    merchantUsers: [],
    refillOrders: [],
    coupons: [],
    customers: [],
  };
}

describe('partner store identity read-only audit units', () => {
  it('separates records, pairs, isolated rows, and confirmed stores', () => {
    const report = summarizePartnerStoreIdentityAudit(sixPairedStores(), {
      ...meta,
      checkedAt: new Date('2026-08-29T16:00:00.000Z'),
      queriedLiveData: true,
    });
    assert.equal(report.valid, true);
    assert.equal(report.decisionReady, true);
    assert.equal(report.totals.merchantMasterCount, 6);
    assert.equal(report.totals.redeemStoreCount, 6);
    assert.equal(report.storeIdentity.byClass.one_to_one, 12);
    assert.equal(report.storeIdentity.oneToOnePairCount, 6);
    assert.equal(report.storeIdentity.oneToOneCanDivideByTwo, true);
    assert.equal(report.storeIdentity.confirmedOneToOneStores, 6);
    assert.equal(report.storeIdentity.orphanMasters, 0);
    assert.equal(report.storeIdentity.orphanRedeemStores, 0);

    const markdown = formatAuditReportMarkdown(report);
    assert.match(markdown, /原始資料總筆數＝一對一資料筆數＋待確認資料筆數＋衝突資料筆數＋孤立資料筆數/);
    assert.match(markdown, /一對一門市組數＝一對一資料筆數 ÷ 2/);
    assert.match(markdown, /已確認一對一門市：6 間（可直接確認）/);
    assert.match(markdown, /實際合作門市總數：暫時未知/);
    assert.doesNotMatch(markdown, /## 實際門市/);
    assert.doesNotMatch(markdown, /一對一 12 間/);
  });

  it('keeps mixed rows reconcilable and never prints PII', () => {
    const report = summarizePartnerStoreIdentityAudit(snapshot(), {
      ...meta,
      queriedLiveData: true,
    });
    assert.equal(report.valid, true);
    assert.equal(report.storeIdentity.oneToOnePairCount, 1);
    assert.equal(report.storeIdentity.confirmedOneToOneStores, 1);
    assert.equal(report.storeIdentity.needsReviewGroupCount, 1);
    assert.equal(report.storeIdentity.orphanRedeemStores, 1);
    assert.equal(report.membersAndLine.separateFromStoreIdentity, true);

    const markdown = formatAuditReportMarkdown(report);
    assert.match(markdown, /已確認一對一門市：1 間（可直接確認）/);
    assert.match(markdown, /待確認門市關係：1 組（尚需總部判斷）/);
    assert.match(markdown, /實際合作門市總數：暫時未知/);
    assert.match(markdown, /報告是否完整通過對帳：是，可供判斷/);

    const notLive = formatAuditReportMarkdown(summarizePartnerStoreIdentityAudit(snapshot(), meta));
    assert.match(notLive, /尚未查到正式資料，不輸出可供決策的正式數字/);
    assert.doesNotMatch(notLive, /店家主檔：2 筆/);
    assert.doesNotMatch(markdown, /0900|U[0-9a-f]{32}|淡水妞妞/);
    assert.match(markdown, /furmosa-0002|MER-0018|niuniu/);
  });

  it('invalidates the whole report when one record has two main classes', () => {
    const dups = findRecordsInMultipleClasses(
      [
        { storeId: 's1', slug: 'mer_0018', class: 'one_to_one', reasons: [], candidateIds: ['MER-0018'] },
        { storeId: 's1', slug: 'mer_0018', class: 'conflict', reasons: [], candidateIds: [] },
      ],
      [],
    );
    assert.equal(dups.length, 1);
    const markdown = formatAuditReportMarkdown(
      summarizePartnerStoreIdentityAudit(snapshot(), meta),
    );
    assert.doesNotMatch(markdown, /報告無效/);
    const invalidMarkdown = formatAuditReportMarkdown({
      ...summarizePartnerStoreIdentityAudit(snapshot(), meta),
      valid: false,
      decisionReady: false,
      invalidReasons: ['主分類重複：同一筆資料進入兩個主分類'],
      storeIdentity: {
        ...summarizePartnerStoreIdentityAudit(snapshot(), meta).storeIdentity,
        duplicateClassRefs: [{ kind: 'store', id: 'mer_0018' }],
      },
    });
    assert.match(invalidMarkdown, /報告無效，不輸出可供決策的正式數字/);
    assert.doesNotMatch(invalidMarkdown, /已確認一對一門市：/);
  });

  it('allows conflict-reason overlap without invalidating exclusive classes', () => {
    const report = summarizePartnerStoreIdentityAudit(
      snapshot({
        stores: [
          { id: 'a', slug: 'mer_0018', name: '甲' },
          { id: 'b', slug: 'MER_0018', name: '乙' },
        ],
        merchants: [
          {
            id: 'm1',
            merchantId: 'MER-0018',
            name: '甲',
            city: null,
            address: null,
            status: 'active',
            types: ['jar_exchange'],
          },
          {
            id: 'm2',
            merchantId: 'mer-0018',
            name: '乙',
            city: null,
            address: null,
            status: 'active',
            types: ['jar_exchange'],
          },
        ],
      }),
      meta,
    );
    assert.equal(report.valid, true);
    assert.ok(report.conflictSubtypes.mayExceedConflictCount);
    assert.ok(report.conflictSubtypes.subtypeSum > report.storeIdentity.byClass.conflict);
  });
});
